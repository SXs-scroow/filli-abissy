import test from 'node:test';
import assert from 'node:assert/strict';
import { runEndToEndProbe, evaluateEndToEnd, summarize } from '../../src/e2eLoadTest.js';

/** Realtime falso em memória: entrega os avisos "player-changed" e a presença como o servidor faria. */
function makeHub({ dropEvery = 0, failSubscribe = false, failFirst = 0, delay = 2 } = {}) {
  let subscribeCalls = 0;
  const subs = new Map();
  const presence = new Map();
  let counter = 0;
  const hub = {
    saves: [], cleanups: [], created: new Set(),
    createRealtimeClient() {
      return {
        channel(topic, opts = {}) {
          const handlers = { broadcast: [], presence: [] };
          const key = opts?.config?.presence?.key;
          const ch = {
            topic,
            on(type, filter, cb) { handlers[type]?.push({ filter, cb }); return ch; },
            subscribe(cb) {
              subscribeCalls += 1;
              if (failSubscribe || (topic === 'a-profecia-players-events' && subscribeCalls <= failFirst)) { setTimeout(() => cb('CHANNEL_ERROR'), 1); return ch; }
              if (!subs.has(topic)) subs.set(topic, new Set());
              subs.get(topic).add({ handlers, ch });
              setTimeout(() => cb('SUBSCRIBED'), 1);
              return ch;
            },
            track() {
              if (!presence.has(topic)) presence.set(topic, new Map());
              presence.get(topic).set(key, true);
              setTimeout(() => { for (const s of subs.get(topic) || []) for (const h of s.handlers.presence) h.cb(); }, delay);
              return Promise.resolve('ok');
            },
            presenceState() { return Object.fromEntries([...(presence.get(topic) || new Map()).keys()].map((k) => [k, [{}]])); },
          };
          return ch;
        },
        removeChannel() { return Promise.resolve(); },
        realtime: { disconnect() {} },
      };
    },
    async savePlayer({ id, deletedAt }) {
      hub.saves.push(id);
      assert.ok(deletedAt, 'fichas de teste devem nascer excluídas para não aparecer na lista');
      assert.match(id, /^__loadtest_[a-z0-9]+_(\d+|warm)$/);
      const op = hub.created.has(id) ? 'update' : 'insert';
      hub.created.add(id);
      setTimeout(() => {
        for (const s of subs.get('a-profecia-players-events') || []) {
          counter += 1;
          if (dropEvery && counter % dropEvery === 0) continue;
          for (const h of s.handlers.broadcast) h.cb({ payload: { id, op } });
        }
      }, delay);
    },
  };
  return hub;
}

const opts = { clients: 5, rows: 3, waves: 2, connectTimeoutMs: 300, presenceTimeoutMs: 600, deliveryTimeoutMs: 400, onStage() {} };

function depsFor(hub, over = {}) {
  return {
    createRealtimeClient: () => hub.createRealtimeClient(),
    savePlayer: (x) => hub.savePlayer(x),
    cleanup: async () => { hub.cleanups.push(1); return { players: hub.created.size }; },
    ...over,
  };
}

test('caminho feliz: todos os avisos chegam, a presença converge e a limpeza apaga tudo', async () => {
  const hub = makeHub();
  const r = await runEndToEndProbe(depsFor(hub), opts);
  assert.equal(r.verdict, 'passed', JSON.stringify(r));
  assert.equal(r.metrics.writes.ok, 6);
  assert.equal(r.metrics.delivery.expected, 5 * 6);
  assert.equal(r.metrics.delivery.received, 30);
  assert.equal(r.metrics.presence.converged, true);
  assert.equal(r.metrics.cleanup.players, 4, '3 fichas medidas + 1 de aquecimento');
  assert.equal(r.metrics.cleanupExpected, 4);
  assert.equal(r.metrics.delivery.expected, 30, 'o aquecimento não entra na medição');
});

test('avisos de Realtime perdidos reprovam o teste', async () => {
  const hub = makeHub({ dropEvery: 4 });
  const r = await runEndToEndProbe(depsFor(hub), opts);
  assert.equal(r.verdict, 'failed');
  assert.ok(r.reasons.some((x) => /avisos de Realtime não chegaram/.test(x)), r.reasons.join('|'));
});

test('sem a função de limpeza no servidor o teste nem cria dados', async () => {
  const hub = makeHub();
  const r = await runEndToEndProbe(depsFor(hub, { cleanup: async () => { throw new Error('function not found'); } }), opts);
  assert.equal(r.verdict, 'inconclusive');
  assert.equal(hub.saves.length, 0, 'nada pode ser gravado sem garantia de limpeza');
});

test('falhas de gravação reprovam e a limpeza ainda roda', async () => {
  const hub = makeHub();
  const r = await runEndToEndProbe(depsFor(hub, { savePlayer: async () => { throw new Error('NAO_AUTORIZADO'); } }), opts);
  assert.equal(r.verdict, 'inconclusive');
  assert.ok(hub.cleanups.length >= 2, 'pré-checagem e limpeza final');
});

test('limpeza incompleta reprova', async () => {
  const hub = makeHub();
  const r = await runEndToEndProbe(depsFor(hub, { cleanup: async () => ({ players: 1 }) }), opts);
  assert.equal(r.verdict, 'failed');
  assert.ok(r.reasons.some((x) => /limpeza apagou 1 de 4/.test(x)), r.reasons.join('|'));
});

test('limpeza que falha no fim é reportada', async () => {
  const hub = makeHub();
  let calls = 0;
  const r = await runEndToEndProbe(depsFor(hub, { cleanup: async () => { calls += 1; if (calls > 1) throw new Error('boom'); return { players: 0 }; } }), opts);
  assert.equal(r.verdict, 'failed');
  assert.ok(r.reasons.some((x) => /limpeza falhou/.test(x)));
});

test('Realtime indisponível é inconclusivo, não aprovado', async () => {
  const hub = makeHub({ failSubscribe: true });
  const r = await runEndToEndProbe(depsFor(hub), opts);
  assert.equal(r.verdict, 'inconclusive');
});

test('avaliação e resumo de latência', () => {
  assert.deepEqual(summarize([10, 20, 30, 40]), { samples: 4, p50: 20, p95: 40, max: 40 });
  const base = { clients: 15, connect: { ok: 15, failed: 0 }, presence: { converged: true, ms: 100 }, writes: { ok: 20, failed: 0, uniqueIds: 10, latency: { p95: 100 } }, delivery: { expected: 10, received: 10, latency: { p95: 5000 } }, cleanup: { players: 10 }, errors: [], runId: 'abc' };
  assert.equal(evaluateEndToEnd(base).verdict, 'failed');
  assert.match(evaluateEndToEnd(base).reasons[0], /p95 de 5000 ms/);
});

test('a limpeza no banco cobre todas as tabelas que os gatilhos alimentam com fichas de teste', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../../supabase/migrations/20261116120000_loadtest_cleanup.sql', import.meta.url), 'utf8');
  for (const table of ['a_profecia_players', 'a_profecia_player_history', 'a_profecia_players_history', 'a_profecia_player_points', 'a_profecia_player_secrets']) {
    assert.ok(sql.includes(`public.${table}`), `a limpeza não cobre ${table}`);
  }
  assert.match(sql, /s\.role <> 'master'/);
  assert.match(sql, /'\\_\\_loadtest\\_'/);
});

test('cliente que falha na primeira conexão ganha uma segunda tentativa', async () => {
  const hub = makeHub({ failFirst: 2 });
  const r = await runEndToEndProbe(depsFor(hub), opts);
  assert.equal(r.verdict, 'passed', JSON.stringify(r.reasons));
  assert.equal(r.metrics.connect.failed, 0);
  assert.equal(r.metrics.connect.retried, 2);
  assert.ok(r.stages.some((x) => /após nova tentativa/.test(x)));
});

test('ninguém conectar nem na segunda tentativa deixa o resultado inconclusivo, e poucas falhas se recuperam', async () => {
  const hub = makeHub({ failFirst: 100 });
  const r = await runEndToEndProbe(depsFor(hub), opts);
  assert.equal(r.verdict, 'inconclusive');
  const hub2 = makeHub({ failFirst: 3 });
  // 3 falhas globais: 3 clientes tentam de novo e conectam; passa.
  const ok = await runEndToEndProbe(depsFor(hub2), opts);
  assert.equal(ok.verdict, 'passed');
});

test('o aquecimento acontece antes das gravações medidas e não entra na latência', async () => {
  const hub = makeHub();
  await runEndToEndProbe(depsFor(hub), opts);
  assert.match(hub.saves[0], /_warm$/);
  assert.equal(hub.saves.length, 1 + 3 * 2);
});

test('o resultado mostra cada etapa com o limite que estourou', async () => {
  const hub = makeHub();
  const r = await runEndToEndProbe(depsFor(hub), opts);
  assert.equal(r.stages.length, 4);
  assert.ok(r.stages.every((x) => typeof x === 'string'));
  const slow = evaluateEndToEnd({ clients: 15, connect: { ok: 15, failed: 0, retried: 0, latency: { p95: 100 } }, presence: { converged: true, ms: 100 }, writes: { ok: 20, failed: 0, uniqueIds: 10, latency: { p95: 4200 } }, delivery: { expected: 10, received: 10, latency: { p95: 200 } }, cleanup: { players: 10 }, errors: [], runId: 'abc' });
  assert.equal(slow.verdict, 'failed');
  assert.ok(slow.stages.some((x) => /gravação: p95 4200 ms.*ACIMA DO LIMITE/.test(x)), slow.stages.join('|'));
});
