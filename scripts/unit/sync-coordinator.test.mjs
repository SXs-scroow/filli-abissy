import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';

const sourcePath = resolve('src/syncCoordinator.js');
const storageSource = readFileSync(resolve('src/persistence/browserStorage.js'), 'utf8')
  .replace(/export\s+/g, '');
const syncSource = readFileSync(sourcePath, 'utf8')
  .replace(/^import .*browserStorage\.js';\s*/m, '')
  .replace(/export\s+/g, '');

function makeHarness() {
  const data = new Map();
  const events = [];
  const listeners = new Map();
  const timers = [];
  const localStorage = {
    getItem: k => data.has(k) ? data.get(k) : null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k)
  };
  const window = {
    __ashenSyncCoordinatorBound: false,
    addEventListener: (name, fn) => listeners.set(`window:${name}`, fn),
    dispatchEvent: event => { events.push(event); return true; },
    setTimeout: fn => { timers.push(fn); return timers.length; }
  };
  const document = { hidden: false, addEventListener: (name, fn) => listeners.set(`document:${name}`, fn) };
  class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  const context = vm.createContext({
    console: { warn() {} }, Date, Math, Promise, String, Error, Object, JSON,
    localStorage, window, document, navigator: { onLine: true }, CustomEvent,
    setTimeout: fn => { timers.push(fn); return timers.length; },
    clearTimeout() {}
  });
  vm.runInContext(storageSource, context);
  vm.runInContext(syncSource + '\n globalThis.__syncApi = { configureSyncCoordinator, enqueueGlobalSnapshot, flushPending, syncQueueStatus };', context);
  return { api: context.__syncApi, data, events, timers };
}

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

test('coordenador serializa snapshots e não apaga um snapshot novo durante envio antigo', async () => {
  const h = makeHarness();
  const gate = deferred();
  const sent = [];
  h.api.configureSyncCoordinator(async payload => {
    sent.push(payload.revision);
    if (payload.revision === 1) await gate.promise;
    return { updated_at: `rev-${payload.revision}` };
  });
  const first = h.api.enqueueGlobalSnapshot({ revision: 1 });
  await new Promise(r => setImmediate(r));
  const second = h.api.enqueueGlobalSnapshot({ revision: 2 });
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(sent, [1, 2]);
  assert.equal(h.api.syncQueueStatus().pending, false);
  assert.equal(h.data.has('a_profecia_global_pending_v2'), false);
});

test('falha remota mantém o snapshot pendente para retry e informa erro', async () => {
  const h = makeHarness();
  h.api.configureSyncCoordinator(async () => { throw new Error('rede caiu'); });
  await assert.rejects(h.api.enqueueGlobalSnapshot({ revision: 7 }), /rede caiu/);
  assert.equal(h.api.syncQueueStatus().pending, true);
  const persisted = JSON.parse(h.data.get('a_profecia_global_pending_v2'));
  assert.equal(persisted.payload.revision, 7);
  assert.ok(h.events.some(e => e.type === 'a-profecia-sync-queue' && e.detail.status === 'error'));
  assert.ok(h.timers.length > 0, 'retry com backoff foi agendado');
});

test('fila pendente é recuperada após recriar o coordenador', async () => {
  const first = makeHarness();
  first.api.configureSyncCoordinator(async () => { throw new Error('offline'); });
  await assert.rejects(first.api.enqueueGlobalSnapshot({ revision: 11 }), /offline/);
  const persisted = first.data.get('a_profecia_global_pending_v2');

  const second = makeHarness();
  second.data.set('a_profecia_global_pending_v2', persisted);
  let sent;
  second.api.configureSyncCoordinator(async payload => { sent = payload; return { updated_at: 'ok' }; });
  await second.api.flushPending();
  assert.equal(sent.revision, 11);
  assert.equal(second.api.syncQueueStatus().pending, false);
});
