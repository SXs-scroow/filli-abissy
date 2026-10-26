import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const rawSource = readFileSync('src/globalSync.js', 'utf8')
  .replace(/^import .*;\s*$/gm, '')
  .replace("const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;", "const url = 'https://staging.test.invalid';")
  .replace("const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;", "const key = 'test-anon-key';")
  .replace(/export\s+/g, '');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function createHarness(sharedDb) {
  const storageValues = new Map();
  const sessionValues = new Map([['a_profecia_auth_token_v1', 'test-token']]);
  const listeners = [];
  const bus = sharedDb.bus;
  const localStorage = {
    getItem: key => storageValues.has(key) ? storageValues.get(key) : null,
    setItem: (key, value) => storageValues.set(key, String(value)),
    removeItem: key => storageValues.delete(key)
  };
  const sessionStorage = {
    getItem: key => sessionValues.get(key) || null,
    setItem: (key, value) => sessionValues.set(key, String(value)),
    removeItem: key => sessionValues.delete(key)
  };
  const window = {
    addEventListener: (name, cb) => listeners.push([`window:${name}`, cb]),
    dispatchEvent: () => true,
    setTimeout,
    clearTimeout
  };
  const document = { hidden: false, addEventListener: (name, cb) => listeners.push([`document:${name}`, cb]) };
  class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }

  const client = {
    async rpc(name, args) {
      if (name === 'a_profecia_push_global') {
        if (sharedDb.failPush) return { data: null, error: { message: 'fake database failure' } };
        const updatedAt = `stamp-${++sharedDb.stamp}`;
        sharedDb.global = { data: args.p_data, updated_at: updatedAt };
        return { data: { updated_at: updatedAt }, error: null };
      }
      if (name === 'a_profecia_get_global') return { data: sharedDb.global, error: null };
      if (name === 'a_profecia_whoami') return { data: { role: 'master' }, error: null };
      return { data: null, error: null };
    },
    channel(topic, config = {}) {
      const channel = {
        topic,
        config,
        bindings: [],
        serverBindings: [],
        subscribed: false,
        on(type, filter, callback) {
          this.bindings.push({ type, filter, callback });
          return this;
        },
        subscribe(callback) {
          // Supabase serializes broadcast bindings as part of the channel join.
          // Bindings added after this point must not be considered server-side.
          this.serverBindings = [...this.bindings];
          this.statusCallback = callback;
          bus.channels.add(this);
          queueMicrotask(() => {
            if (sharedDb.failRealtime) {
              callback('CHANNEL_ERROR');
              return;
            }
            this.subscribed = true;
            callback('SUBSCRIBED');
          });
          return this;
        },
        async send(message) {
          bus.broadcast(this, message);
          return 'ok';
        },
        async unsubscribe() {
          bus.channels.delete(this);
          this.subscribed = false;
          return 'ok';
        }
      };
      return channel;
    },
    async removeChannel(channel) {
      bus.channels.delete(channel);
      channel.subscribed = false;
      return 'ok';
    },
    async removeAllChannels() {
      for (const channel of [...bus.channels]) if (channel.client === this) bus.channels.delete(channel);
    }
  };

  // Annotate channels with their owning client so the mock can support cleanup.
  const originalChannel = client.channel.bind(client);
  client.channel = (topic, config) => {
    const channel = originalChannel(topic, config);
    channel.client = client;
    return channel;
  };

  const context = vm.createContext({
    console: { ...console, warn: () => {}, error: () => {} },
    Date, Math, Promise, String, Number, Boolean, Object, Array, Set, Map, Symbol, JSON, Error, RegExp,
    CustomEvent, window, document, navigator: { onLine: true }, localStorage, sessionStorage,
    setTimeout, clearTimeout, queueMicrotask,
    createClient: () => client,
    readStoredJson(key, fallback, storage = localStorage) {
      try { const raw = storage.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; }
    },
    writeStoredJson(key, value, storage = localStorage) {
      try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    }
  });
  vm.runInContext(rawSource + '\n globalThis.__api = { subscribeGlobal, pushGlobal, fetchGlobal, broadcastLive };', context);
  return { api: context.__api, client, storageValues, listeners };
}

function createSharedDb() {
  const bus = {
    channels: new Set(),
    broadcast(sender, message) {
      for (const channel of this.channels) {
        if (!channel.subscribed || channel === sender || channel.topic !== sender.topic) continue;
        for (const binding of (channel.serverBindings || [])) {
          if (binding.type === 'broadcast' && binding.filter?.event === message.event) {
            binding.callback({ payload: message.payload || {} });
          }
        }
      }
    }
  };
  return { bus, global: { data: { initial: true }, updated_at: 'initial' }, stamp: 0, failPush: false, failRealtime: false };
}

async function waitFor(predicate, timeoutMs = 1200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await delay(10);
  }
  return false;
}

test('global save emits a shared Realtime event and another session fetches the confirmed row', async () => {
  const db = createSharedDb();
  const receiver = createHarness(db);
  const sender = createHarness(db);
  const received = [];
  const unsubscribe = receiver.api.subscribeGlobal(row => received.push(row));

  assert.equal(await waitFor(() => [...db.bus.channels].some(channel => channel.topic === 'a-profecia-live-v2' && channel.bindings.some(binding => binding.filter?.event === 'global-changed'))), true, 'receiver must subscribe to global-changed on the shared topic');

  const saved = await sender.api.pushGlobal({ campaignRevision: 54, marker: 'confirmed' });
  assert.equal(saved.verified, true, 'server-confirmed save remains successful');
  assert.equal(await waitFor(() => received.length > 0), true, 'receiver must see the Realtime event and fetchGlobal');
  assert.equal(received[0].updated_at, db.global.updated_at);
  assert.equal(received[0].data.marker, 'confirmed');
  assert.ok([...db.bus.channels].some(channel => channel.topic === 'a-profecia-live-v2'));
  assert.ok(![...db.bus.channels].some(channel => channel.topic.startsWith('a-profecia-global-events-')), 'no per-tab random topic should be created');

  unsubscribe();
});

test('Realtime failure cannot turn a server-confirmed global save into a false save failure', async () => {
  const db = createSharedDb();
  const sender = createHarness(db);
  db.failRealtime = true;
  const result = await sender.api.pushGlobal({ marker: 'saved-even-if-realtime-fails' });
  await delay(20);
  assert.equal(result.verified, true);
  assert.equal(db.global.data.marker, 'saved-even-if-realtime-fails');
});


test('broadcast handlers are registered before channel join and shared by all subscribers', async () => {
  const db = createSharedDb();
  const receiver = createHarness(db);
  const first = [];
  const second = [];
  const offFirst = receiver.api.subscribeGlobal(row => first.push(row));
  const offSecond = receiver.api.subscribeGlobal(row => second.push(row));

  assert.equal(await waitFor(() => [...db.bus.channels].some(channel => channel.topic === 'a-profecia-live-v2' && channel.subscribed)), true);
  const live = [...db.bus.channels].find(channel => channel.topic === 'a-profecia-live-v2');
  assert.ok(live);
  assert.ok(live.serverBindings.some(binding => binding.filter?.event === 'global-changed'), 'global-changed must be in the server-side join payload');
  assert.equal(live.serverBindings.filter(binding => binding.filter?.event === 'global-changed').length, 1, 'multiple subscribers must not add duplicate server bindings');

  const sender = createHarness(db);
  await sender.api.pushGlobal({ marker: 'shared-dispatch' });
  assert.equal(await waitFor(() => first.length === 1 && second.length === 1), true, 'both subscribers should receive one refresh');
  offFirst();
  offSecond();
});

test('shared Realtime channel reconnects after a connection closes while subscribers remain', async () => {
  const db = createSharedDb();
  const receiver = createHarness(db);
  const received = [];
  const unsubscribe = receiver.api.subscribeGlobal(row => received.push(row));
  assert.equal(await waitFor(() => [...db.bus.channels].some(channel => channel.topic === 'a-profecia-live-v2' && channel.subscribed)), true);
  const firstChannel = [...db.bus.channels].find(channel => channel.topic === 'a-profecia-live-v2' && channel.subscribed);
  firstChannel.statusCallback('CLOSED');

  assert.equal(await waitFor(() => [...db.bus.channels].some(channel => channel !== firstChannel && channel.topic === 'a-profecia-live-v2' && channel.subscribed), 4500), true, 'a replacement channel should subscribe after a disconnect');
  const sender = createHarness(db);
  await sender.api.pushGlobal({ marker: 'after-reconnect' });
  assert.equal(await waitFor(() => received.some(row => row.data?.marker === 'after-reconnect')), true, 'events should flow after reconnecting');
  unsubscribe();
});
