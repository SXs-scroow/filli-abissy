// Executa o simulateRosterConvergence REAL do app.js (que por sua vez usa o applyPlayerRows real).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractFunction, readAppSources, playerPrelude } from '../chaos/extract-app.mjs';

const src = readAppSources();
const NEEDED = ['imageValue', 'clone', 'playerSyncKey', 'keepNewerLocalPoints', 'isEmptySheetValue', 'preserveLocalSheetAgainstReset', 'adoptPlayerInPlace', 'playerRowStamp', 'playerRowDeletedStamp',
  'mergeRollHistory', 'mergeSecretClues', 'applyPlayerRows', 'simulateRosterConvergence'];

function build(mutate = t => t) {
  const real = { players: [{ id: 'REAL', login: 'real', name: 'Ficha real' }], playerTombstones: { keep: 1 }, session: { role: 'master' } };
  const normalizeFixture = e => {
    // Mirrors the real resource rule relevant to this regression: HP max is derived
    // from Corpo. A fixture without Corpo gets HP max 1, which caused the false failure.
    if (!e || !('login' in e)) return e;
    const body = Math.max(0, Number(e.attrs?.Corpo) || 0);
    const sanity = Math.max(0, Number(e.attrs?.Sanidade) || 0);
    const hpCap = e.campaignType === 'slasher' ? 9999 : 35;
    e.hpMax = Math.max(1, Math.min(hpCap, body * 9));
    e.hp = Math.max(0, Math.min(Number(e.hp ?? e.hpMax) || 0, e.hpMax));
    e.sanityMax = Math.min(35, sanity * 9);
    e.sanity = Math.max(0, Math.min(Number(e.sanity ?? e.sanityMax) || 0, e.sanityMax));
    return e;
  };
  const ctx = vm.createContext({ JSON, Date, Math, Map, Set, Object, Array, String, Number, console, playerStoreEnabled: true, normalize: normalizeFixture, state: real });
  const code = NEEDED.map(n => extractFunction(src, n)).join('\n');
  vm.runInContext(`${playerPrelude("'ORIGINAL'")}\n${mutate(code)}\nglobalThis.sim=simulateRosterConvergence;globalThis.snap=()=>ps.lastSnapshot;`, ctx);
  return { ctx, real };
}

test('simulação com o código real converge (20 aparelhos, 3 rodadas)', () => {
  const { ctx } = build();
  const r = ctx.sim(20, 3);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
});

test('as fichas artificiais têm Corpo suficiente para a Vida derivada e convergem em 7, não 1', () => {
  const { ctx } = build();
  const r = ctx.sim(20, 3);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.equal(r.total, 0);
});

test('a simulação NÃO altera o state real (players, tombstones, snapshot)', () => {
  const { ctx, real } = build();
  const before = JSON.stringify(real);
  ctx.sim(20, 3);
  assert.equal(JSON.stringify(ctx.state), before);
  assert.equal(ctx.snap(), 'ORIGINAL');
});

test('o state é restaurado mesmo quando a simulação quebra no meio', () => {
  const { ctx, real } = build(c => c.replace('function applyPlayerRows(rows,', 'function applyPlayerRows(rows,').replace('const beforeState=JSON.stringify(host.state.players||[]);', 'throw new Error("boom");const beforeState=0;'));
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

test('resistência de escala: 20, 50 e 100 aparelhos convergem sem divergência de Vida', () => {
  for (const n of [20, 50, 100]) {
    const { ctx, real } = build();
    const before = JSON.stringify(real);
    const started = Date.now();
    const r = ctx.sim(n, 3);
    const elapsed = Date.now() - started;
    assert.equal(r.ok, true, `${n} aparelhos: ${JSON.stringify(r.problems)}`);
    assert.equal(r.total, 0, `${n} aparelhos: divergências detectadas`);
    assert.equal(JSON.stringify(ctx.state), before, `${n} aparelhos: estado real alterado`);
    assert.ok(elapsed < 15000, `${n} aparelhos demorou demais: ${elapsed}ms`);
  }
});
