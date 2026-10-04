// Reproduz, com o syncPlayersDbNow REAL, a corrida em que o sync automático (que espera a rede) sobrescreve
// state.players com uma cópia velha e faz Players criados/atualizados durante a espera "sumirem".
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAppSandbox } from '../chaos/extract-app.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../app.js');
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));
const mk = (id, stamp = 1000, extra = {}) => ({ id, login: id, name: id, hp: 10, hpMax: 10, secretClues: [], rolls: [], _syncUpdatedAt: stamp, ...extra });
const toRow = p => ({ id: p.id, login: p.login, data: JSON.parse(JSON.stringify(p)), updated_at: new Date(p._syncUpdatedAt).toISOString(), deleted_at: null });

function setup(ids = ['A', 'B', 'C', 'D', 'E']) {
  const server = new Map(ids.map(id => [id, toRow(mk(id))]));
  const calls = { upserts: [], fetches: 0 };
  const hooks = { duringFetch: null, duringUpsert: null };
  const store = {
    fetchPlayers: async () => { calls.fetches++; await tick(); if (hooks.duringFetch) { const h = hooks.duringFetch; hooks.duringFetch = null; h(); } await tick(); return [...server.values()].map(r => JSON.parse(JSON.stringify(r))); },
    fetchPlayersByIds: async ids2 => ids2.map(i => server.get(i)).filter(Boolean),
    upsertPlayers: async ps => { await tick(); if (hooks.duringUpsert) { const h = hooks.duringUpsert; hooks.duringUpsert = null; h(); } for (const p of ps) { calls.upserts.push(p.id); server.set(p.id, toRow(p)); } return ps.map(p => server.get(p.id)); },
    upsertPlayerTombstones: async () => {}
  };
  const sb = buildAppSandbox(app, store);
  sb.ctx.state = { players: ids.map(id => mk(id)), playerTombstones: {}, session: { role: 'master' } };
  sb.api.markHydrated();
  return { ...sb, server, calls, hooks, ids: () => Array.from(sb.ctx.state.players, p => p.id).sort() };
}

test('estado estável: sync automático repetido não reenvia nem perde ninguém', async () => {
  const t = setup();
  for (let i = 0; i < 3; i++) assert.equal(await t.api.sync(false), true);
  assert.deepEqual(t.ids(), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(t.calls.upserts.length, 0);
});

test('Player criado pelo Mestre DURANTE a leitura do servidor não some', async () => {
  const t = setup();
  t.hooks.duringFetch = () => t.ctx.state.players.push(mk('NOVO', 5000, { _pendingCreate: true }));
  await t.api.sync(false);
  assert.ok(t.ids().includes('NOVO'), `sumiu! lista: ${t.ids()}`);
});

test('Player registrado em outro aparelho (chega por Realtime) DURANTE o envio não some', async () => {
  const t = setup();
  Object.assign(t.ctx.state.players.find(p => p.id === 'A'), { _syncUpdatedAt: 4000, hp: 6 }); // edição local real -> força um upsert (abre a janela de espera)
  t.hooks.duringUpsert = () => { const r = mk('REGISTRADO', 5000); t.server.set('REGISTRADO', toRow(r)); t.ctx.state.players.push(r); };
  await t.api.sync(false);
  assert.ok(t.ids().includes('REGISTRADO'), `sumiu! lista: ${t.ids()}`);
});

test('atualização mais nova aplicada pelo Realtime DURANTE o sync não é revertida', async () => {
  const t = setup();
  t.hooks.duringFetch = () => { const i = t.ctx.state.players.findIndex(p => p.id === 'B'); t.ctx.state.players[i] = mk('B', 9000, { hp: 3 }); };
  await t.api.sync(false);
  assert.equal(t.ctx.state.players.find(p => p.id === 'B').hp, 3, 'vida revertida pelo sync');
});

test('edição do Mestre durante o upsert não é perdida', async () => {
  const t = setup();
  t.ctx.state.players.find(p => p.id === 'A')._syncUpdatedAt = 4000; // A local mais novo -> será enviado
  t.ctx.state.players.find(p => p.id === 'A').hp = 6;
  t.hooks.duringUpsert = () => t.ctx.state.players.push(mk('NOVO2', 6000, { _pendingCreate: true }));
  await t.api.sync(false);
  assert.ok(t.ids().includes('NOVO2'), `sumiu! lista: ${t.ids()}`);
});

test('exclusão feita pelo Mestre DURANTE o sync continua excluída', async () => {
  const t = setup();
  t.hooks.duringFetch = () => { t.ctx.state.players = t.ctx.state.players.filter(p => p.id !== 'C'); t.ctx.state.playerTombstones.C = 7000; };
  await t.api.sync(false);
  assert.ok(!t.ids().includes('C'), 'ficha excluída ressuscitou');
});

test('salvar do Mestre com um sync automático já em andamento ainda envia a ficha nova ao servidor', async () => {
  const t = setup();
  Object.assign(t.ctx.state.players.find(p => p.id === 'A'), { _syncUpdatedAt: 4000, hp: 6 }); // edição local real -> força upsert no sync automático
  let fresh;
  t.hooks.duringUpsert = () => {                       // o Mestre cria o Player e clica em salvar NESTE instante
    t.ctx.state.players.push(mk('NOVO3', 8000, { _pendingCreate: true }));
    fresh = t.api.sync(false, { fresh: true });        // o botão salvar chama o sync enquanto o automático ainda roda
  };
  await t.api.sync(false);
  assert.equal(await fresh, true);
  assert.ok(t.server.has('NOVO3'), 'servidor não recebeu a ficha nova, mas o app diria "salvo"');
  assert.ok(t.ids().includes('NOVO3'), `sumiu da lista: ${t.ids()}`);
});

test('Player novo (pendente) é enviado e PERMANECE na lista depois do sync', async () => {
  const t = setup();
  t.ctx.state.players.push(mk('NOVO4', 8000, { _pendingCreate: true }));
  await t.api.sync(false);
  assert.ok(t.server.has('NOVO4'));
  assert.ok(t.ids().includes('NOVO4'), `sumiu da lista: ${t.ids()}`);
  assert.equal(t.ctx.state.players.find(p => p.id === 'NOVO4')._pendingCreate, undefined);
});

test('ficha local que NÃO está no servidor e não é pendente continua sendo removida do Mestre', async () => {
  const t = setup();
  t.ctx.state.players.push(mk('FANTASMA', 8000));
  await t.api.sync(false);
  assert.ok(!t.ids().includes('FANTASMA'));
  assert.ok(!t.server.has('FANTASMA'), 'nunca pode ressuscitar cache antigo');
});
