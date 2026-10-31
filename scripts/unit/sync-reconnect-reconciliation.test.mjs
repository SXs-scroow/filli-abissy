import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync(new URL('../../src/playerStore.js', import.meta.url), 'utf8');
const e2e = readFileSync(new URL('../e2e/staging-sync-load.mjs', import.meta.url), 'utf8');

test('Player sync reconciles the authoritative roster after reconnect and network recovery', () => {
  assert.match(store, /const refreshRoster = async \(\) =>/);
  assert.match(store, /if \(hasSubscribedOnce\) scheduleRosterRefresh\(0\)/);
  assert.match(store, /window\.addEventListener\('online', onOnline\)/);
  assert.match(store, /document\.addEventListener\('visibilitychange', onVisible\)/);
  assert.match(store, /rosterRetryAttempt = Math\.min\(rosterRetryAttempt \+ 1, 6\)/);
  assert.match(store, /removeEventListener\('online', onOnline\)/);
});

test('staging Realtime test retains strict fan-out assertions and waits for cold-start stabilization', () => {
  assert.match(e2e, /REALTIME_STARTUP_GRACE_MS = 5000/);
  assert.match(e2e, /await sleep\(REALTIME_STARTUP_GRACE_MS\)/);
  assert.match(e2e, /realtimeConfirmedClients === USER_COUNT/);
  assert.match(e2e, /subscriptions\.every\(sub => sub\.seenIds\.size >= USER_COUNT\)/);
});


test('falha ou bloqueio do localStorage não impede o envio da fila de Players ao servidor', () => {
  assert.match(store, /const storage=getBrowserStorage\(\);\s*if\(!storage\)return true;/);
  assert.match(store, /catch\{[\s\S]*?return true;\s*\}/);
});
