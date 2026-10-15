import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractFunction } from '../chaos/extract-app.mjs';

const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ Array, Set, String, Number, Boolean, Object });
vm.runInContext(`${extractFunction(app, 'combatParticipantKey')}\n${extractFunction(app, 'buildCombatSessionParticipants')}\nglobalThis.make=buildCombatSessionParticipants;`, ctx);

const players = [
  { id: 'p-1', login: 'ana', name: 'Ana' },
  { id: 'p-2', login: 'beto', name: 'Beto' },
  { login: 'caio', name: 'Caio' },
];

test('seleciona somente os IDs marcados na abertura da nova sessão', () => {
  const rows = ctx.make(players, ['p-2', 'caio']);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(p => p.name), ['Beto', 'Caio']);
  assert.deepEqual(rows.map(p => p.turnOrder), [0, 1]);
});

test('não duplica participantes se uma identidade for repetida', () => {
  const rows = ctx.make([players[0], { ...players[0], name: 'Ana cópia' }], ['p-1']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Ana');
});

test('uma seleção vazia não importa automaticamente todo o elenco', () => {
  assert.deepEqual(ctx.make(players, []), []);
});
