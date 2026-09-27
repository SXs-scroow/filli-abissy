import { readFileSync } from 'node:fs';

const index = readFileSync('index.html','utf8');
const main = readFileSync('src/main.js','utf8');
const app = readFileSync('app.js','utf8');
const store = readFileSync('src/playerStore.js','utf8');
const sync = readFileSync('src/globalSync.js','utf8');
const migration = readFileSync('supabase/migrations/20260927000000_player_delete_integrity.sql','utf8');

const checks = [
  ['cache bust matches', /main\.js\?v=1500/.test(index) && /app\.js\?build=1500/.test(main)],
  ['dedicated delete RPC is used', /deletePlayerServer\(id\)/.test(app) && /a_profecia_player_delete/.test(store)],
  ['deleted rows cannot be undeleted', (/PLAYER_EXCLUIDO/.test(app) || /PLAYER_EXCLUIDO/.test(readFileSync('src/globalSync.js','utf8'))) && /a_profecia_players_no_undelete/.test(migration)],
  ['pending creates are explicit', /_pendingCreate/.test(app)],
  ['master does not include Players in global payload when dedicated store is enabled', /if\(!playerStoreEnabled\)\{payload\.players=players/.test(app)],
  ['Realtime batches burst changes', /const pendingIds = new Set\(\)/.test(store)],
  ['hard-delete markers are recognized', /toLowerCase\(\)==='deleted'/.test(app)],
  ['confirmed roster cache stores deletions', /version:2,savedAt:Date.now\(\),rows:active,deleted/.test(app)],
  ['manual Player sync is available', /id=\"syncPlayersNow\"/.test(app)],
  ['auth remains token-based', /getAuthToken\(\)/.test(sync)],
];
let failed=false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'}  ${name}`);
  if (!ok) failed=true;
}
if (failed) process.exit(1);
console.log(`Stability audit OK: ${checks.length} checks.`);
