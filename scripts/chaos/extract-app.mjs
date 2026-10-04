// Extrai do app.js REAL as funções de sincronização de Players (sem refatorar o
// arquivo de 400 KB) e as executa num sandbox `vm` com stubs mínimos de DOM/estado.
// Se alguém renomear/mover essas funções, o teste falha alto em vez de passar em falso.
import { readFileSync } from 'node:fs';
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

const NEEDED = ['imageValue', 'clone', 'sameGlobalValue', 'playerSyncKey', 'mergeRollHistory', 'mergeSecretClues',
  'playerRowStamp', 'playerRowDeletedStamp', 'saveConfirmedPlayerRoster',
  'fetchPlayerRowsConfirmed', 'applyPlayerRows', 'syncPlayersDbNow', 'hydratePlayersDb'];

export function buildAppSandbox(appPath, store) {
  const src = readFileSync(appPath, 'utf8');
  const fns = NEEDED.map(n => extractFunction(src, n)).join('\n');
  const mem = new Map();
  const ctx = vm.createContext({
    console: { warn() {}, log() {}, error() {} },
    setTimeout, clearTimeout, JSON, Date, Math, Promise, Map, Set, Object, Array, String, Number,
    playerStoreEnabled: true,
    fetchPlayerRows: store.fetchPlayers,
    upsertPlayers: store.upsertPlayers,
    upsertPlayerTombstones: store.upsertPlayerTombstones,
    storageGet: k => mem.get(k) ?? null,
    storageSet: (k, v) => { mem.set(k, v); },
    KEY: 'app_state', PLAYER_ROSTER_CACHE_KEY: 'a_profecia_server_roster_v1',
    serializeState: () => JSON.stringify(ctx.state),
    normalize: e => e,                       // stub: o normalize real é grande e só ajusta campos
    refreshMasterPlayersAdminView() {}, persistCriticalCache() {}, persistSessionCache() {},
    applyConfirmedPlayerRosterFallback() {}, toast() {},
    state: null
  });
  vm.runInContext(`
    let playerDbHydrated=false,playerDbApplying=false,playerDbHydrating=false,playerDbHydratePromise=null,playerDbLastSyncAt=0;
    let playerDbSyncBusy=false,playerDbSyncPromise=null,playerSyncCircuitOpen=false,playerDbReadOnly=false;
    let lastPlayersSnapshot=[];
    ${fns}
    globalThis.__api={
      sync:(m,o)=>syncPlayersDbNow(m,o), hydrate:()=>hydratePlayersDb(),
      peek:()=>({readOnly:playerDbReadOnly,hydrated:playerDbHydrated,busy:playerDbSyncBusy}),
      markHydrated:()=>{playerDbHydrated=true}
    };
  `, ctx);
  return { ctx, api: ctx.__api, mem };
}
