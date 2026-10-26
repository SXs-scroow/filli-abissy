import { readFileSync } from 'node:fs';

const index = readFileSync('index.html','utf8');
const main = readFileSync('src/main.js','utf8');
// V1.5.2: lógica de Players está em src/players.js; as verificações olham app.js + players.js juntos.
const app = readFileSync('app.js','utf8') + '\n' + readFileSync('src/players.js','utf8');
const store = readFileSync('src/playerStore.js','utf8');
const sync = readFileSync('src/globalSync.js','utf8');
const migration = readFileSync('supabase/migrations/20260927000000_player_delete_integrity.sql','utf8');
const explicitMigration = readFileSync('supabase/migrations/20260930000000_list_players_explicit_deleted_at.sql','utf8');
const syncRegression = readFileSync('scripts/player-sync-regression.mjs','utf8');
const passwordMigration = readFileSync('supabase/migrations/20260929110000_player_password_reset_and_sync_guard.sql','utf8');
const vercelConfig = JSON.parse(readFileSync('vercel.json','utf8'));
const rootCacheControl = vercelConfig.headers.find((rule) => rule.source === '/')?.headers?.find((h) => h.key === 'Cache-Control')?.value || '';
const buildInfo = readFileSync('src/version/buildInfo.js','utf8');
const viteConfig = readFileSync('vite.config.js','utf8');

const checks = [
  ['HTML entry is not pinned to a stale manual cache version', /src="\/src\/main\.js"/.test(index) && !/main\.js\?v=/.test(index) && /import ['"]\.\.\/app\.js['"]/.test(main) && !/app\.js\?build=/.test(main)],
  ['HTML cache is disabled and deployment build ID is exposed', /no-store/.test(rootCacheControl) && /VERCEL_DEPLOYMENT_ID/.test(viteConfig) && /__ASHEN_BUILD_ID__/.test(buildInfo)],
  ['dedicated delete RPC is used', /deletePlayerServer\(id\)/.test(app) && /a_profecia_player_delete/.test(store)],
  ['deleted rows cannot be undeleted', (/PLAYER_EXCLUIDO/.test(app) || /PLAYER_EXCLUIDO/.test(readFileSync('src/globalSync.js','utf8'))) && /a_profecia_players_no_undelete/.test(migration)],
  ['pending creates are explicit', /_pendingCreate/.test(app)],
  ['master does not include Players in global payload when dedicated store is enabled', /if\(!playerStoreEnabled\)\{payload\.players=players/.test(app)],
  ['Realtime batches burst changes', /const pendingOps = new Map\(\)/.test(store)],
  ['Realtime topic matches the database trigger topic', /channel\('a-profecia-players-events'\)/.test(store) && /'a-profecia-players-events'/.test(readFileSync('supabase/migrations/20260922150708_v1_secure_player_reads_and_realtime.sql','utf8'))],
  ['targeted reads do not silently truncate rosters above 50 IDs', /offset \+= 50/.test(store) && /clean\.slice\(offset, offset \+ 50\)/.test(store)],
  ['Realtime errors preserve queued events with bounded backoff', /evento será repetido/.test(store) && /pendingOps\.size/.test(store) && /30000/.test(store)],
  ['hard-delete markers are recognized', /toLowerCase\(\)==='deleted'/.test(app)],
  ['confirmed roster cache stores deletions', /version:2,savedAt:Date.now\(\),rows:active,deleted/.test(app)],
  ['manual Player sync is available', /id=\"syncPlayersNow\"/.test(app)],
  ['auth remains token-based', /getAuthToken\(\)/.test(sync)],
  ['Realtime row events are non-authoritative', /applyPlayerRows\(\[row\],\{authoritative:false\}\)/.test(app)],
  ['password reset has dedicated server RPC', /changePlayerPassword\(/.test(sync) && /a_profecia_player_set_password/.test(passwordMigration)],
  ['Player list RPC returns the own row with explicit deleted_at', /where p\.id = s\.player_id;/.test(explicitMigration) && /a_profecia_revoked_player_sessions/.test(explicitMigration)],
  ['deleted Player sessions are NOT kept alive (no widened privileges)', !/create or replace function public\.a_profecia_player_delete/.test(explicitMigration) && /before delete on public\.a_profecia_sessions/.test(explicitMigration)],
  ['realtime only treats a physical DELETE as a missing-row deletion after confirmation', /batch\.get\(id\)\?\.op === 'delete'/.test(store) && /const confirmRows = await fetchPlayersByIds\(missingDeletes\)/.test(store)],
  ['network chaos test is included', /createChaosProxy/.test(readFileSync('scripts/chaos/network-chaos.test.mjs','utf8'))],
  ['sync regression suite is included', /Player sync regression audit/.test(syncRegression)],
  ['Player roster polling uses jitter to avoid synchronized client bursts', /delay\*\(0\.85\+Math\.random\(\)\*0\.30\)/.test(app) && /schedulePlayerReconcile/.test(app)],
  ['global state polling uses jitter and schedules the next request after completion', /pollDelay\*\(0\.85\+Math\.random\(\)\*0\.30\)/.test(app) && /finally\{scheduleGlobalPoll\(\);\}/.test(app)],
];
let failed=false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'}  ${name}`);
  if (!ok) failed=true;
}
if (failed) process.exit(1);
console.log(`Stability audit OK: ${checks.length} checks.`);
