import { readFileSync } from 'node:fs';

const index = readFileSync('index.html','utf8');
const main = readFileSync('src/main.js','utf8');
const app = readFileSync('app.js','utf8');
const store = readFileSync('src/playerStore.js','utf8');
const sync = readFileSync('src/globalSync.js','utf8');
const migration = readFileSync('supabase/migrations/20260927000000_player_delete_integrity.sql','utf8');
const explicitMigration = readFileSync('supabase/migrations/20260930000000_list_players_explicit_deleted_at.sql','utf8');
const syncRegression = readFileSync('scripts/player-sync-regression.mjs','utf8');
const passwordMigration = readFileSync('supabase/migrations/20260929110000_player_password_reset_and_sync_guard.sql','utf8');

const checks = [
  ['cache bust matches', /main\.js\?v=1500/.test(index) && /app\.js\?build=1500/.test(main)],
  ['dedicated delete RPC is used', /deletePlayerServer\(id\)/.test(app) && /a_profecia_player_delete/.test(store)],
  ['deleted rows cannot be undeleted', (/PLAYER_EXCLUIDO/.test(app) || /PLAYER_EXCLUIDO/.test(readFileSync('src/globalSync.js','utf8'))) && /a_profecia_players_no_undelete/.test(migration)],
  ['pending creates are explicit', /_pendingCreate/.test(app)],
  ['master does not include Players in global payload when dedicated store is enabled', /if\(!playerStoreEnabled\)\{payload\.players=players/.test(app)],
  ['Realtime batches burst changes', /const pendingOps = new Map\(\)/.test(store)],
  ['hard-delete markers are recognized', /toLowerCase\(\)==='deleted'/.test(app)],
  ['confirmed roster cache stores deletions', /version:2,savedAt:Date.now\(\),rows:active,deleted/.test(app)],
  ['manual Player sync is available', /id=\"syncPlayersNow\"/.test(app)],
  ['auth remains token-based', /getAuthToken\(\)/.test(sync)],
  ['Realtime row events are non-authoritative', /applyPlayerRows\(\[row\],\{authoritative:false\}\)/.test(app)],
  ['password reset has dedicated server RPC', /changePlayerPassword\(/.test(sync) && /a_profecia_player_set_password/.test(passwordMigration)],
  ['Player list RPC returns the own row with explicit deleted_at', /where p\.id = s\.player_id;/.test(explicitMigration) && /a_profecia_revoked_player_sessions/.test(explicitMigration)],
  ['deleted Player sessions are NOT kept alive (no widened privileges)', !/create or replace function public\.a_profecia_player_delete/.test(explicitMigration) && /before delete on public\.a_profecia_sessions/.test(explicitMigration)],
  ['realtime only treats a physical DELETE as a missing-row deletion', /ops\.get\(id\) === 'delete'/.test(store)],
  ['network chaos test is included', /createChaosProxy/.test(readFileSync('scripts/chaos/network-chaos.test.mjs','utf8'))],
  ['sync regression suite is included', /Player sync regression audit/.test(syncRegression)],
];
let failed=false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'}  ${name}`);
  if (!ok) failed=true;
}
if (failed) process.exit(1);
console.log(`Stability audit OK: ${checks.length} checks.`);
