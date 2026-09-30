// Teste de rede instável (V68).
//
// Sobe um servidor Supabase de teste + um proxy que CORTA O SOCKET de verdade no
// meio de uma sincronização, e roda o código REAL do projeto (src/playerStore.js e
// as funções de sync do app.js) contra ele. Verifica que a ficha continua intacta.
//
// Rodar:  npm run test:chaos
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFakeSupabase } from './fake-supabase.mjs';
import { createChaosProxy } from './chaos-proxy.mjs';
import { loadRealStore, cleanupBuild } from './load-modules.mjs';
import { buildAppSandbox } from './extract-app.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let fake, proxy, store, gs;

const big = 'x'.repeat(300_000); // foto grande: o corpo da requisição atravessa vários pacotes TCP
const ficha = (id, over = {}) => ({
  id, login: id, name: `Ficha ${id}`, hp: 30, hpMax: 35, hunger: 80,
  backpack: [{ name: 'Lanterna', qty: 1 }, { name: 'Faca', qty: 2 }],
  rolls: [{ id: 'r1', value: 17, die: 'd20' }], photo: `data:image/png;base64,${big}`,
  _syncUpdatedAt: 1000, ...over
});
const clone = v => JSON.parse(JSON.stringify(v));
// valores vindos do sandbox `vm` têm outro realm: normaliza antes de comparar com deepEqual
const plain = clone;
const ids = c => plain(c.ctx.state.players.map(p => p.id)).sort();

function makeClient(role, playerId, players = []) {
  gs.setAuthToken(role === 'master' ? 'tok-master' : `tok-${playerId}`);
  const sb = buildAppSandbox(resolve(root, 'app.js'), store);
  sb.ctx.state = {
    session: { role, playerId: playerId || '', login: playerId || 'mestre', playerSnapshot: playerId ? clone(players.find(p => p.id === playerId) || {}) : null },
    players: clone(players), playerTombstones: {}
  };
  sb.api.markHydrated();
  return sb;
}

before(async () => {
  fake = createFakeSupabase();
  const fakePort = await fake.listen();
  proxy = createChaosProxy(fakePort);
  const proxyPort = await proxy.listen();
  const sessions = {};
  globalThis.sessionStorage = { getItem: k => sessions[k] ?? null, setItem: (k, v) => { sessions[k] = v; }, removeItem: k => { delete sessions[k]; } };
  ({ store, gs } = await loadRealStore(`http://127.0.0.1:${proxyPort}`));
});
after(async () => { await proxy.close(); await fake.close(); cleanupBuild(); });
beforeEach(() => {
  fake.reset(); proxy.heal(); proxy.clearLog();
  fake.addSession('tok-master', 'master');
  fake.addSession('tok-p1', 'player', 'p1');
});

// ---------------------------------------------------------------- contrato
test('contrato: o Player recebe a PRÓPRIA linha com deleted_at explícito quando excluída', async () => {
  gs.setAuthToken('tok-p1');
  fake.seedPlayer(ficha('p1'));
  let rows = await store.fetchPlayers();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].deleted_at, null);

  gs.setAuthToken('tok-master');
  await store.deletePlayerServer('p1');

  gs.setAuthToken('tok-p1');
  rows = await store.fetchPlayers();
  assert.equal(rows.length, 1, 'a linha NÃO pode sumir da lista');
  assert.equal(rows[0].id, 'p1');
  assert.ok(rows[0].deleted_at, 'deleted_at explícito');
});

test('segurança: token do Player excluído lê SÓ a própria exclusão e não grava nada', async () => {
  fake.seedPlayer(ficha('p1')); fake.seedPlayer(ficha('p2'));
  fake.addSession('tok-p2', 'player', 'p2');
  gs.setAuthToken('tok-master');
  await store.deletePlayerServer('p1');

  assert.equal(fake.db.sessions.has('tok-p1'), false, 'sessão apagada (upload-asset e demais RPCs barram)');
  gs.setAuthToken('tok-p1');
  const rows = await store.fetchPlayers();
  assert.deepEqual(rows.map(r => r.id), ['p1'], 'vê apenas a própria linha');
  await assert.rejects(
    () => store.upsertPlayers([ficha('p1', { hp: 1, _syncUpdatedAt: 9999 })]),
    e => /SESSAO_INVALIDA/.test(String(e?.message || e)), 'não consegue gravar');
  assert.equal(fake.db.players.get('p1').deleted_at !== null, true);

  gs.setAuthToken('tok-desconhecido');
  await assert.rejects(() => store.fetchPlayers(), e => /SESSAO_INVALIDA/.test(String(e?.message || e)), 'token inventado segue inválido');
});

// ------------------------------------------------ corte no meio do UPLOAD
test('corte no meio do envio da ficha: ficha local e servidor intactos; retry converge', async () => {
  fake.seedPlayer(ficha('p1'));
  const edited = ficha('p1', { hp: 12, _syncUpdatedAt: 2000, backpack: [{ name: 'Lanterna', qty: 1 }, { name: 'Faca', qty: 2 }, { name: 'Corda', qty: 1 }] });
  const c = makeClient('player', 'p1', [edited]);
  const expectedLocal = clone(c.ctx.state.players[0]);

  proxy.inject('a_profecia_player_save', 'cut-request', { bytes: 50_000 });
  const ok = await c.api.sync(true);

  assert.equal(ok, false, 'sync reporta falha');
  assert.equal(c.api.peek().readOnly, true);
  assert.deepEqual(ids(c), ['p1'], 'a ficha continua na lista');
  assert.deepEqual(plain(c.ctx.state.players[0]), expectedLocal, 'ficha local intacta (nada zerado)');
  assert.deepEqual(c.ctx.state.session.playerSnapshot.id, 'p1', 'snapshot de fallback preservado');
  assert.deepEqual(plain(c.ctx.state.playerTombstones), {}, 'nenhuma tombstone fabricada');
  assert.equal(fake.db.players.get('p1').data.hp, 30, 'servidor não recebeu escrita parcial');
  assert.equal(proxy.count('a_profecia_player_save', 'cut-request'), 1, 'o corte realmente aconteceu');

  proxy.heal();
  assert.equal(await c.api.sync(true), true, 'com a rede de volta, converge');
  const srv = fake.db.players.get('p1');
  assert.equal(srv.data.hp, 12);
  assert.equal(srv.data.backpack.length, 3);
  assert.equal(fake.db.calls.filter(x => x.rpc === 'save' && x.applied).length, 1, 'gravou exatamente uma vez');
  assert.equal(c.ctx.state.players[0].hp, 12);
});

// ------------------------------- servidor aplicou, mas a resposta se perdeu
test('resposta perdida (servidor aplicou, cliente não soube): retry é seguro e idempotente', async () => {
  fake.seedPlayer(ficha('p1'));
  const edited = ficha('p1', { hp: 9, _syncUpdatedAt: 3000 });
  const c = makeClient('player', 'p1', [edited]);

  proxy.inject('a_profecia_player_save', 'drop-response');
  assert.equal(await c.api.sync(true), false);
  assert.equal(fake.db.players.get('p1').data.hp, 9, 'o servidor já tinha aplicado');
  assert.equal(c.ctx.state.players[0].hp, 9, 'ficha local intacta');

  proxy.heal();
  assert.equal(await c.api.sync(true), true);
  assert.equal(c.ctx.state.players.length, 1);
  assert.equal(c.ctx.state.players[0].hp, 9);
  assert.equal(fake.db.players.get('p1').data.hp, 9);
  assert.equal(fake.db.calls.filter(x => x.rpc === 'save' && x.applied).length, 1, 'sem gravação duplicada');
});

// ------------------------------------- corte no meio da LEITURA do roster
test('corte no meio da leitura: ficha, snapshot e tombstones intactos', async () => {
  fake.seedPlayer(ficha('p1', { _syncUpdatedAt: 1000 }));
  const c = makeClient('player', 'p1', [ficha('p1', { _syncUpdatedAt: 1000 })]);
  const before = clone(c.ctx.state.players[0]);

  proxy.inject('a_profecia_list_players', 'cut-response', { times: 4, fraction: 0.4 });
  assert.equal(await c.api.sync(true), false);
  assert.deepEqual(plain(c.ctx.state.players[0]), before);
  assert.equal(c.ctx.state.session.playerSnapshot.id, 'p1');
  assert.deepEqual(plain(c.ctx.state.playerTombstones), {});

  proxy.heal();
  assert.equal(await c.api.sync(true), true);
  assert.deepEqual(ids(c), ['p1']);
});

test('leitura vazia transitória (200 com []): Player não perde a ficha', async () => {
  fake.seedPlayer(ficha('p1'));
  const c = makeClient('player', 'p1', [ficha('p1')]);
  const before = clone(c.ctx.state.players[0]);
  fake.db.glitchEmptyReads = 2; // as duas leituras de confirmação vêm vazias
  await c.api.sync(true);
  assert.deepEqual(plain(c.ctx.state.players[0]), before);
  assert.equal(c.ctx.state.session.playerSnapshot.id, 'p1');
  assert.deepEqual(plain(c.ctx.state.playerTombstones), {});
});

// ----------------------------------------------- exclusão explícita chegando
test('exclusão pelo Mestre chega ao Player como deleted_at explícito (e só então some)', async () => {
  fake.seedPlayer(ficha('p1'));
  const c = makeClient('player', 'p1', [ficha('p1')]);

  gs.setAuthToken('tok-master');
  await store.deletePlayerServer('p1');
  gs.setAuthToken('tok-p1');

  // Rede cai justo na leitura seguinte: ninguém sabe se foi excluída => NÃO remove.
  proxy.inject('a_profecia_list_players', 'cut-response', { times: 2 });
  await c.api.sync(true);
  assert.equal(c.ctx.state.players.length, 1, 'sem confirmação explícita a ficha fica');

  proxy.heal();
  await c.api.sync(true);
  assert.equal(c.ctx.state.players.length, 0, 'com deleted_at explícito a ficha sai');
  assert.ok(c.ctx.state.playerTombstones.p1 > 0, 'tombstone registrada a partir do servidor');
  assert.equal(c.ctx.state.session.playerSnapshot.id, 'p1', 'snapshot mantido para exibir o aviso');
});

test('Player com edição local pendente + ficha excluída no servidor: não tenta gravar e não é deslogado', async () => {
  fake.seedPlayer(ficha('p1'));
  const c = makeClient('player', 'p1', [ficha('p1', { hp: 3, _syncUpdatedAt: 9000 })]);
  gs.setAuthToken('tok-master'); await store.deletePlayerServer('p1'); gs.setAuthToken('tok-p1');
  let expired = 0;
  globalThis.window = { dispatchEvent() { expired++; return true; } };
  globalThis.CustomEvent = class { constructor(t) { this.type = t; } };
  proxy.clearLog();
  await c.api.sync(true);
  assert.equal(proxy.count('a_profecia_player_save'), 0, 'nenhuma gravação tentada em ficha excluída');
  assert.equal(expired, 0, 'nenhum evento de sessão expirada');
  assert.equal(c.ctx.state.players.length, 0);
  assert.equal(c.ctx.state.session.playerSnapshot.id, 'p1', 'última cópia ainda disponível para exibição');
  delete globalThis.window; delete globalThis.CustomEvent;
});

// -------------------------------- Mestre: corte no meio de uma exclusão
test('Mestre: corte no meio da exclusão não perde os outros Players e o retry conclui', async () => {
  for (const id of ['p1', 'p2', 'p3']) fake.seedPlayer(ficha(id));
  const c = makeClient('master', null, ['p1', 'p2', 'p3'].map(id => ficha(id)));
  c.ctx.state.playerTombstones = { p2: Date.now() }; // intenção explícita de excluir p2
  c.ctx.state.players = c.ctx.state.players.filter(p => p.id !== 'p2');

  proxy.inject('a_profecia_player_delete', 'cut-request', { bytes: 20 });
  assert.equal(await c.api.sync(true), false);
  assert.deepEqual(ids(c), ['p1', 'p3']);
  assert.ok(c.ctx.state.playerTombstones.p2, 'tombstone preservada para nova tentativa');
  assert.equal(fake.db.players.get('p2').deleted_at, null, 'servidor ainda não aplicou');

  proxy.heal();
  assert.equal(await c.api.sync(true), true);
  assert.ok(fake.db.players.get('p2').deleted_at, 'exclusão concluída');
  assert.equal(fake.db.calls.filter(x => x.rpc === 'delete' && x.applied).length, 1, 'excluiu uma única vez');
  assert.deepEqual(ids(c), ['p1', 'p3']);
});

// ------------------------------------------------------------- Realtime
function realtimeHarness() {
  let handler;
  const channel = { on(_t, _f, cb) { handler = cb; return channel; }, subscribe() { return channel; } };
  const original = gs.supabase.channel;
  gs.supabase.channel = () => channel;
  const events = [];
  const unsub = store.subscribePlayers(row => events.push(row));
  return {
    events, emit: (id, op) => handler({ payload: { id, op } }),
    stop() { unsub(); gs.supabase.channel = original; }
  };
}
const settle = ms => new Promise(r => setTimeout(r, ms));

test('realtime: ausência na leitura NÃO fabrica exclusão; exclusão explícita e DELETE físico sim', async () => {
  gs.setAuthToken('tok-p1');
  fake.seedPlayer(ficha('p1'));
  const rt = realtimeHarness();
  try {
    // (a) evento sobre a própria ficha + rede cortada => nenhum callback
    proxy.inject('a_profecia_list_players', 'cut-response', { times: 5 });
    rt.emit('p1', 'update'); await settle(300);
    assert.equal(rt.events.length, 0);
    proxy.heal();

    // (b) evento sobre OUTRO Player (RLS não devolve a linha) => nada de 'deleted' inventado
    rt.emit('p9', 'update'); await settle(900);
    assert.equal(rt.events.length, 0, 'ausência não é exclusão');

    // (c) exclusão explícita da própria ficha => callback com deleted_at real
    gs.setAuthToken('tok-master'); await store.deletePlayerServer('p1'); gs.setAuthToken('tok-p1');
    rt.emit('p1', 'update'); await settle(300);
    assert.equal(rt.events.length, 1);
    assert.ok(rt.events[0].deleted_at && rt.events[0].deleted_at !== 'deleted', 'deleted_at vem da linha');

    // (d) DELETE físico anunciado pelo trigger (op=delete) => marcador
    rt.emit('p7', 'delete'); await settle(900);
    assert.equal(rt.events.length, 2);
    assert.deepEqual(rt.events[1], { id: 'p7', deleted_at: 'deleted' });
  } finally { rt.stop(); }
});
