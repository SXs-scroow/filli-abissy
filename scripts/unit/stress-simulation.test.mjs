// Exercita o módulo de carga isolado contra o applyPlayerRows REAL do app.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { extractFunction, readAppSources, playerPrelude } from '../chaos/extract-app.mjs';
import { simulateRosterConvergence, loadAdmin, runPlayerStressTest } from '../../src/loadTest.js';

const src = readAppSources();
const NEEDED = ['imageValue', 'clone', 'playerSyncKey', 'keepNewerLocalPoints', 'isEmptySheetValue', 'preserveLocalSheetAgainstReset', 'adoptPlayerInPlace', 'playerRowStamp', 'playerRowDeletedStamp',
  'mergeRollHistory', 'mergeSecretClues', 'applyPlayerRows'];

function build(mutate = t => t) {
  const real = { players: [{ id: 'REAL', login: 'real', name: 'Ficha real' }], playerTombstones: { keep: 1 }, session: { role: 'master' } };
  const normalizeFixture = e => {
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
  vm.runInContext(`${playerPrelude("'ORIGINAL'")}\n${mutate(code)}\nglobalThis.realApply=applyPlayerRows;globalThis.realClone=clone;globalThis.realPs=ps;globalThis.snap=()=>ps.lastSnapshot;`, ctx);
  return { ctx, real };
}
function sim(ctx, n=20, cycles=3) {
  return simulateRosterConvergence({ state: ctx.state, ps: ctx.realPs, applyPlayerRows: ctx.realApply, clone: ctx.realClone }, n, cycles);
}

test('simulação com o código real converge (20 aparelhos, 3 rodadas)', () => {
  const { ctx } = build();
  const r = sim(ctx, 20, 3);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
});

test('as fichas artificiais têm Corpo suficiente para a Vida derivada e convergem em 7, não 1', () => {
  const { ctx } = build();
  const r = sim(ctx, 20, 3);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.equal(r.total, 0);
});

test('a simulação NÃO altera o state real (players, tombstones, snapshot)', () => {
  const { ctx, real } = build();
  const before = JSON.stringify(real);
  sim(ctx, 20, 3);
  assert.equal(JSON.stringify(ctx.state), before);
  assert.equal(ctx.snap(), 'ORIGINAL');
});

test('o state é restaurado mesmo quando a simulação quebra no meio', () => {
  const { ctx, real } = build(c => c.replace('const beforeState=JSON.stringify(host.state.players||[]);', 'throw new Error("boom");const beforeState=0;'));
  const before = JSON.stringify(real);
  const r = sim(ctx, 20, 3);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /boom/);
  assert.equal(JSON.stringify(ctx.state), before);
});

test('DETECTA o bug das pistas (ficha local com relógio adiantado descarta a pista do servidor)', () => {
  const { ctx } = build(c => c.replace("}else if(localPlayer&&row?.data&&typeof row.data==='object'&&Array.isArray(row.data.secretClues)", "}else if(false&&localPlayer&&row?.data&&typeof row.data==='object'&&Array.isArray(row.data.secretClues)"));
  const r = sim(ctx, 20, 3);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /pistas/);
});

test('DETECTA ficha excluída que continua existindo', () => {
  const { ctx } = build(c => { assert.ok(c.includes('if(deleted){')); return c.replace('if(deleted){', 'if(false){'); });
  const r = sim(ctx, 20, 3);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /exclu/);
});

test('DETECTA resposta atrasada sobrescrevendo ficha mais nova', () => {
  const { ctx } = build(c => c.replace('(!localPlayer||stamp>localStamp)', '(true)'));
  const r = sim(ctx, 20, 3);
  assert.equal(r.ok, false);
});

test('resistência de escala: 20, 50 e 100 aparelhos convergem sem divergência de Vida', () => {
  for (const n of [20, 50, 100]) {
    const { ctx, real } = build();
    const before = JSON.stringify(real);
    const started = Date.now();
    const r = sim(ctx, n, 3);
    const elapsed = Date.now() - started;
    assert.equal(r.ok, true, `${n} aparelhos: ${JSON.stringify(r.problems)}`);
    assert.equal(r.total, 0, `${n} aparelhos: divergências detectadas`);
    assert.equal(JSON.stringify(ctx.state), before, `${n} aparelhos: estado real alterado`);
    assert.ok(elapsed < 15000, `${n} aparelhos demorou demais: ${elapsed}ms`);
  }
});

test('renderizador do laboratório não depende de window em execução de teste', () => {
  const markup = loadAdmin('V1.5.55');
  assert.match(markup, /Meta de capacidade — 15 pessoas simultâneas/);
  assert.match(markup, /runPlayerStressTest/);
  assert.match(markup, /não simula gravações reais/i);
});


function installBrowserStubs() {
  const descriptors = new Map();
  for (const key of ['window', 'document', 'navigator']) descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  const elements = Object.fromEntries(['runPlayerStressTest', 'playerStressStatus', 'playerStressDetails'].map(id => [id, { id, textContent: '', disabled: false }]));
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: {} });
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: { getElementById: id => elements[id] || null } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { onLine: true } });
  return { elements, restore() {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  } };
}

test('teste de carga executa 15 leituras concorrentes somente de leitura e restaura o estado', async () => {
  const { ctx, real } = build();
  const browser = installBrowserStubs();
  const before = JSON.stringify(real);
  let startedReads = 0, activeReads = 0, maxActiveReads = 0;
  try {
    await runPlayerStressTest({
      version: 'V1.5.55', state: ctx.state, ps: ctx.realPs,
      applyPlayerRows: ctx.realApply, clone: ctx.realClone,
      playerStoreEnabled: true, getAuthToken: () => 'token-de-teste',
      fetchPlayersByIds: async ids => {
        startedReads++;
        activeReads++; maxActiveReads = Math.max(maxActiveReads, activeReads);
        await new Promise(resolve => setTimeout(resolve, 2));
        activeReads--;
        return ids.map(id => ({ id }));
      }, toast() {}
    });
    const report = globalThis.window.__aProfeciaStressReport;
    assert.equal(report.status, 'partial', JSON.stringify(report), 'sonda somente de leitura nunca pode declarar capacidade E2E aprovada');
    assert.equal(report.targetUsers, 15);
    assert.equal(report.endToEndValidated, false);
    assert.equal(report.serverReads, 15);
    assert.equal(report.serverFailures, 0);
    assert.equal(report.serverMaxInFlight, 15);
    assert.equal(report.serverLatency.samples, 15);
    assert.ok(report.serverLatency.p95 >= report.serverLatency.p50);
    assert.equal(startedReads, 15);
    assert.equal(maxActiveReads, 15, 'as 15 leituras devem ficar simultaneamente em voo');
    assert.equal(JSON.stringify(ctx.state), before, 'o teste não deve alterar as fichas reais');
    assert.equal(browser.elements.runPlayerStressTest.disabled, false);
  } finally { browser.restore(); }
});

test('sem armazenamento remoto, o teste informa PARCIAL e não tenta ler nem gravar no servidor', async () => {
  const { ctx, real } = build();
  const browser = installBrowserStubs();
  const before = JSON.stringify(real);
  let reads = 0;
  try {
    await runPlayerStressTest({
      version: 'V1.5.55', state: ctx.state, ps: ctx.realPs,
      applyPlayerRows: ctx.realApply, clone: ctx.realClone,
      playerStoreEnabled: false, getAuthToken: () => '',
      fetchPlayersByIds: async () => { reads++; return []; }, toast() {}
    });
    const report = globalThis.window.__aProfeciaStressReport;
    assert.equal(report.status, 'partial');
    assert.match(report.skipReason, /desativado/);
    assert.equal(reads, 0);
    assert.equal(JSON.stringify(ctx.state), before);
  } finally { browser.restore(); }
});
