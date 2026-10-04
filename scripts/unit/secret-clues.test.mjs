// Executa o applyPlayerRows REAL do app.js para garantir que pistas secretas não somem.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractFunction } from '../chaos/extract-app.mjs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const NEEDED = ['imageValue', 'clone', 'playerSyncKey', 'playerRowStamp', 'playerRowDeletedStamp',
  'mergeRollHistory', 'mergeSecretClues', 'applyPlayerRows'];

function makeSandbox(localPlayers, role = 'player', activeId = 'p1') {
  const ctx = vm.createContext({ JSON, Date, Math, Map, Set, Object, Array, String, Number, console,
    playerStoreEnabled: true, normalize: () => {},
    state: { players: localPlayers, playerTombstones: {}, session: { role, playerId: activeId, login: 'ana' } } });
  vm.runInContext(`let lastPlayersSnapshot=[];\n${NEEDED.map(n => extractFunction(src, n)).join('\n')}
    globalThis.api={apply:(rows,o)=>applyPlayerRows(rows,o),merge:(...a)=>mergeSecretClues(...a),get players(){return state.players}};`, ctx);
  return ctx.api;
}
const ids = xs => Array.from(xs, c => c.id); // Array.from evita o protótipo de outro realm (vm)
const clue = (id, t = 1) => ({ id, title: id, message: 'm', receivedAt: t });
const row = (data, stamp) => ({ id: 'p1', login: 'ana', data: { id: 'p1', login: 'ana', ...data, _syncUpdatedAt: stamp }, updated_at: new Date(stamp).toISOString(), deleted_at: null });

test('mergeSecretClues: une por id, sem duplicar, mais recente primeiro', () => {
  const api = makeSandbox([]);
  const out = api.merge([clue('a', 1), clue('b', 2)], [clue('b', 2), clue('c', 3)], null, undefined, [null, 5]);
  assert.deepEqual(ids(out), ['c', 'b', 'a']);
});

test('servidor mais novo: pista do Mestre chega e pistas locais são mantidas', () => {
  const api = makeSandbox([{ id: 'p1', login: 'ana', secretClues: [clue('local', 1)], _syncUpdatedAt: 100 }]);
  api.apply([row({ secretClues: [clue('do-mestre', 2)] }, 200)]);
  assert.deepEqual(ids(api.players[0].secretClues).sort(), ['do-mestre', 'local']);
});

test('ficha LOCAL mais nova (relógio adiantado): pista do servidor não é descartada', () => {
  const api = makeSandbox([{ id: 'p1', login: 'ana', hp: 7, secretClues: [], _syncUpdatedAt: 9_999_999 }]);
  api.apply([row({ hp: 10, secretClues: [clue('do-mestre', 2)] }, 200)]);
  assert.equal(api.players[0].hp, 7, 'campos locais continuam vencendo');
  assert.deepEqual(ids(api.players[0].secretClues), ['do-mestre']);
});

test('sem pistas no servidor não apaga as locais', () => {
  const api = makeSandbox([{ id: 'p1', login: 'ana', secretClues: [clue('x')], _syncUpdatedAt: 100 }]);
  api.apply([row({}, 200)]);
  assert.deepEqual(ids(api.players[0].secretClues), ['x']);
});
