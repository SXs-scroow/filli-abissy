// Executa o simulateRosterConvergence REAL do app.js (que por sua vez usa o applyPlayerRows real).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractFunction } from '../chaos/extract-app.mjs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const NEEDED = ['imageValue', 'clone', 'playerSyncKey', 'playerRowStamp', 'playerRowDeletedStamp',
  'mergeRollHistory', 'mergeSecretClues', 'applyPlayerRows', 'simulateRosterConvergence'];

function build(mutate = t => t) {
  const real = { players: [{ id: 'REAL', login: 'real', name: 'Ficha real' }], playerTombstones: { keep: 1 }, session: { role: 'master' } };
  const ctx = vm.createContext({ JSON, Date, Math, Map, Set, Object, Array, String, Number, console, playerStoreEnabled: true, normalize: () => {}, state: real });
  const code = NEEDED.map(n => extractFunction(src, n)).join('\n');
  vm.runInContext(`let lastPlayersSnapshot='ORIGINAL';\n${mutate(code)}\nglobalThis.sim=simulateRosterConvergence;globalThis.snap=()=>lastPlayersSnapshot;`, ctx);
  return { ctx, real };
}

test('simulação com o código real converge (20 aparelhos, 3 rodadas)', () => {
  const { ctx } = build();
  const r = ctx.sim(20, 3);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
});

test('a simulação NÃO altera o state real (players, tombstones, snapshot)', () => {
  const { ctx, real } = build();
  const before = JSON.stringify(real);
  ctx.sim(20, 3);
  assert.equal(JSON.stringify(ctx.state), before);
  assert.equal(ctx.snap(), 'ORIGINAL');
});

test('o state é restaurado mesmo quando a simulação quebra no meio', () => {
  const { ctx, real } = build(c => c.replace('function applyPlayerRows(rows,', 'function applyPlayerRows(rows,').replace('const beforeState=JSON.stringify(state.players||[]);', 'throw new Error("boom");const beforeState=0;'));
  const before = JSON.stringify(real);
  const r = ctx.sim(20, 3);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /boom/);
  assert.equal(JSON.stringify(ctx.state), before);
});

test('DETECTA o bug das pistas (ficha local com relógio adiantado descarta a pista do servidor)', () => {
  const { ctx } = build(c => c.replace("}else if(localPlayer&&row?.data&&typeof row.data==='object'&&Array.isArray(row.data.secretClues)", "}else if(false&&localPlayer&&row?.data&&typeof row.data==='object'&&Array.isArray(row.data.secretClues)"));
  const r = ctx.sim(20, 3);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /pistas/);
});

test('DETECTA ficha excluída que continua existindo', () => {
  const { ctx } = build(c => { assert.ok(c.includes('if(deleted){')); return c.replace('if(deleted){', 'if(false){'); });
  const r = ctx.sim(20, 3);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /exclu/);
});

test('DETECTA resposta atrasada sobrescrevendo ficha mais nova', () => {
  const { ctx } = build(c => c.replace('(!localPlayer||stamp>localStamp)', '(true)'));
  const r = ctx.sim(20, 3);
  assert.equal(r.ok, false);
});
