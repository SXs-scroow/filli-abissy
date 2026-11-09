import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export function extractFunction(src, name) {
  const re = new RegExp(`(?:^|\\n)((?:async )?function ${name}\\s*\\()`);
  const m = re.exec(src);
  if (!m) throw new Error(`Função ${name} não encontrada em app.js`);
  let i = m.index + (m[0].startsWith('\n') ? 1 : 0);
  const start = i;
  i = src.indexOf('{', src.indexOf(')', i));
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`Não consegui delimitar ${name}`);
}

export function readAppSources(appPath = join(dirname(fileURLToPath(import.meta.url)), '../../app.js')) {
  const players = join(dirname(appPath), 'src/players.js');
  return readFileSync(appPath, 'utf8') + '\n' + readFileSync(players, 'utf8');
}
const stampClockSrc = () => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/stampClock.js'), 'utf8').replace(/^export /gm, '');
export const playerPrelude = (snapshot = '[]') =>
  `${stampClockSrc()}\nconst ps={timer:null,hydrated:false,applying:false,hydrating:false,hydratePromise:null,lastSyncAt:0,unsubscribe:null,syncBusy:false,syncPromise:null,circuitOpen:false,readOnly:false,lastSnapshot:${snapshot}};const host={get state(){return state}};`;

const NEEDED = ['imageValue', 'clone', 'sameGlobalValue', 'playerSyncKey', 'keepNewerLocalPoints', 'isEmptySheetValue', 'preserveLocalSheetAgainstReset', 'adoptPlayerInPlace', 'mergeRollHistory', 'mergeSecretClues',
  'playerRowStamp', 'playerRowDeletedStamp', 'saveConfirmedPlayerRoster',
  'fetchPlayerRowsConfirmed', 'applyPlayerRows', 'syncPlayersDbNow', 'hydratePlayersDb'];

export function buildAppSandbox(appPath, store) {
  const src = readAppSources(appPath);
  const fns = NEEDED.map(n => extractFunction(src, n)).join('\n');
  const mem = new Map();
  const ctx = vm.createContext({
    console: { warn() {}, log() {}, error() {} },
    setTimeout, clearTimeout, JSON, Date, Math, Promise, Map, Set, Object, Array, String, Number,
    playerStoreEnabled: true,
    fetchPlayerRows: store.fetchPlayers,
    fetchPlayersByIds: store.fetchPlayersByIds,
    upsertPlayers: store.upsertPlayers,
    upsertPlayerTombstones: store.upsertPlayerTombstones,
    storageGet: k => mem.get(k) ?? null,
    storageSet: (k, v) => { mem.set(k, v); },
    KEY: 'app_state', PLAYER_ROSTER_CACHE_KEY: 'a_profecia_server_roster_v1',
    serializeState: () => JSON.stringify(ctx.state),
    normalize: e => e,
    refreshMasterPlayersAdminView() {}, persistCriticalCache() {}, persistSessionCache() {},
    applyConfirmedPlayerRosterFallback() {}, toast() {},
    state: null
  });
  vm.runInContext(`
    ${playerPrelude()}
    ${fns}
    globalThis.__api={
      sync:(m,o)=>syncPlayersDbNow(m,o), hydrate:()=>hydratePlayersDb(),
      peek:()=>({readOnly:ps.readOnly,hydrated:ps.hydrated,busy:ps.syncBusy}),
      markHydrated:()=>{ps.hydrated=true}
    };
  `, ctx);
  return { ctx, api: ctx.__api, mem };
}
