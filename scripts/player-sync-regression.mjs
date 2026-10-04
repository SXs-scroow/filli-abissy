import { readFileSync } from 'node:fs';

const app = readFileSync('app.js','utf8');
const store = readFileSync('src/playerStore.js','utf8');
const sync = readFileSync('src/globalSync.js','utf8');

const checks = [
  ['row reconciliation has an explicit authoritative flag', /function applyPlayerRows\(rows,\{initial=false,authoritative=false\}\=\{\}\)/.test(app)],
  ['Realtime single-row updates are non-authoritative', /applyPlayerRows\(\[row\],\{authoritative:false\}\)/.test(app)],
  ['missing-row pruning only runs for authoritative roster reads', /if\(authoritative&&state\.session\?\.role==='master'/.test(app) && /if\(authoritative&&state\.session\?\.role==='player'/.test(app)],
  ['Realtime application does not immediately queue a write-back sync', !/finally\{playerDbApplying=false\}\s*if\(applyResult\?\.changed\)queuePlayerDbSave\(\);/.test(app)],
  ['password changes use a dedicated server RPC', /changePlayerPassword\(/.test(sync) && /a_profecia_player_set_password/.test(sync)],
  ['Player store does not send plaintext password fields through normal save', /const data = \{ \.\.\.\(row\.data \|\| \{\}\) \};[\s\S]*delete data\.password;[\s\S]*delete data\.newPassword;/.test(store)],
  ['same-view renders preserve scroll position', /const keepViewScroll=prevView===view/.test(app) && /window\.scrollTo\(0,savedScrollY\)/.test(app)],
  ['Master has 20-player stress test UI', /runPlayerStressTest/.test(app) && /Teste de 20 Players/.test(app)],
  ['Player secret clues page is routed by render() (was a dead button)', /view==='secrets'&&state\.session\.role==='player'\?secretCluesPage\(\)/.test(app) && /data-open-secret-clues\]'\)\.forEach\(b=>b\.onclick=\(\)=>render\('secrets'\)\)/.test(app)],
  ['Master entity save declares passwordToSet/secretLovedDraft in the handler scope', /onclick=async\(\)=>\{const isP=type==='player',list=isP\?state\.players:state\.creatures;let passwordToSet='',secretLovedDraft='';/.test(app)],
  ['Same-view re-renders do not replay the enter animation (anti-flicker)', /classList\.toggle\('no-enter-anim',!!same\)/.test(app) && /#root\.no-enter-anim \.main/.test(readFileSync(new URL('../styles.css', import.meta.url), 'utf8'))],
  ['Stress test performs 20-client concurrent targeted server reads', /virtualClients=20/.test(app) && /Promise\.all\(targets\.map\(async\(id\)=>/.test(app) && /fetchPlayersByIds\(id\?\[id\]:\[\]\)/.test(app)],
  ['Stress test uses the real applyPlayerRows in an isolated state', /function simulateRosterConvergence\(/.test(app) && /applyPlayerRows\(rows,\{authoritative:false\}\)\}finally\{c\.players=state\.players/.test(app) && /finally\{state\.players=savedPlayers;state\.playerTombstones=savedTomb;lastPlayersSnapshot=savedSnap\}/.test(app)],
  ['Stress test only opens the circuit breaker on logic failures, never on network errors', /const logicFail=!sim\.ok\|\|serverMismatch\.length>0;/.test(app) && /serverFailures>0\?'inconclusive'/.test(app) && (app.match(/playerSyncCircuitOpen=true/g)||[]).length===1 && /if\(logicFail\)\{[\s\S]{0,400}playerSyncCircuitOpen=true/.test(app)],
  ['Stress test reports PARCIAL (not PASSOU) when the server part was skipped', /outcome=logicFail\?'failed':serverFailures>0\?'inconclusive':skipReason\?'partial':'passed'/.test(app)],
  ['Stress failure opens Player sync circuit breaker', /playerSyncCircuitOpen=true/.test(app) && /if\(playerSyncCircuitOpen&&!manual\)return false/.test(app)],
  ['Automatic reconciliation respects circuit breaker', /if\(playerSyncCircuitOpen\)return;/.test(app)],
  ['Master secret is isolated from Player roster JSON', /delete data\.secretLovedEffect/.test(store) && /a_profecia_player_master_secret_get/.test(sync) && /a_profecia_player_master_secret_save/.test(sync)],
  ['Player command center includes calculated ficha data', /punchDamage\(p\)/.test(app) && /trainedSkills\(p\)/.test(app) && /player-dossier-stats/.test(app)],
  ['Hunger drops automatically every 5 rounds', /round%5===0/.test(app) && /tickPlayerHungerOnRound/.test(app)],
  // V67: um Player não pode perder a própria ficha (nem o snapshot de fallback)
  // por causa de uma leitura vazia/transitória do servidor. Uma segunda leitura
  // confirma antes de tratar isso como autoritativo, e a própria ficha do
  // usuário nunca é apagada por uma ausência isolada.
  ['a confirming second read exists before trusting an empty/missing roster response', /async function fetchPlayerRowsConfirmed\(ids=null\)/.test(app) && /await fetchPlayerRowsConfirmed\(/.test(app)],
  ['hydrate uses the confirmed read instead of a single raw fetch', /const rows=await fetchPlayerRowsConfirmed\([^\n]*\);[\s\S]{0,80}playerDbReadOnly=false;[\s\S]{0,80}playerDbLastSyncAt=Date\.now\(\);[\s\S]{0,80}saveConfirmedPlayerRoster\(rows\);[\s\S]{0,40}if\(rows\.length\)\{/.test(app)],
  ['sync reconciliation uses the confirmed read instead of a single raw fetch', /const rows=await fetchPlayerRowsConfirmed\([^\n]*\);[\s\S]{0,80}playerDbReadOnly=false;/.test(app)],
  ['an empty confirmed roster never nulls a Player session snapshot', !/state\.session\.playerSnapshot=null/.test(app)],
  ['a Player never deletes their own active row from a single missing-row read', /if\(k!==syncActiveId\)localById\.delete\(k\);/.test(app)],
  ['authoritative apply never removes the active Player id from the local roster', /if\(key&&key!==activeId&&!remoteIds\.has\(key\)\)byId\.delete\(key\);/.test(app)],
  ['realtime deletion signals require a confirming second read before firing', /const missing = ids\.filter\(id => !byId\.has\(id\) && ops\.get\(id\) === 'delete'\);/.test(store) && /await new Promise\(resolve => setTimeout\(resolve, 220\)\)/.test(store) && /fetchPlayersByIds\(missing\)/.test(store)],
];
let failed=false;
for(const [name,ok] of checks){console.log(`${ok?'OK':'FAIL'}  ${name}`);if(!ok)failed=true;}
if(failed)process.exit(1);
console.log(`Player sync regression audit OK: ${checks.length} checks.`);

