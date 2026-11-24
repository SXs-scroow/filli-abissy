import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { extractFunction, readAppSources, playerPrelude } from '../chaos/extract-app.mjs';
import { simulateRosterConvergence } from '../../src/loadTest.js';

// Usa o normalize() REAL do app.js (Vida 25+4/ponto, perícias, etc.), não um fixture.
const src = readAppSources();
const NEEDED = ['imageValue', 'clone', 'playerSyncKey', 'keepNewerLocalPoints', 'isEmptySheetValue', 'preserveLocalSheetAgainstReset', 'adoptPlayerInPlace', 'playerRowStamp', 'playerRowDeletedStamp', 'mergeRollHistory', 'mergeSecretClues', 'applyPlayerRows'];
const REAL = ['normalize', 'syncDerivedResources', 'derivedMax', 'campaignResourceMax', 'effectiveAttr', 'clamp', 'allAttrs', 'allSkills', 'customList', 'blankLimits', 'blankAttrs', 'blankSkills'];

test('a simulação de convergência passa com o normalize real do app (15 e 30 aparelhos)', () => {
  const real = { players: [{ id: 'REAL', login: 'real', name: 'Ficha real' }], playerTombstones: {}, session: { role: 'master' }, creatures: [], customContent: { attrs: [], skills: [] } };
  const out = {};
  const store = { JSON, Date, Math, Map, Set, Object, Array, String, Number, Boolean, console, playerStoreEnabled: true, state: real, __out: out,
    classBonusMap: () => ({}), characterRules: () => ({}), derivedCombat: () => ({ atk: 0, def: 0 }), initializeConditionTurns: () => {}, item: () => null };
  const ctx = vm.createContext(store);
  const lines = (re) => src.match(re) || [];
  const code = [lines(/const MAX_HP=45[^\n]*/)[0], ...lines(/const ATTRS=[^\n]*/g), ...lines(/const SKILLS=[^\n]*/g), 'const DET_DEFAULT_MAX=3;',
    ...[...REAL, ...NEEDED].map((n) => extractFunction(src, n))].join('\n');
  vm.runInContext(`${playerPrelude("'ORIGINAL'")}\n${code}\n__out.apply=applyPlayerRows;__out.clone=clone;__out.ps=ps;`, ctx);
  const before = JSON.stringify(real);
  for (const n of [15, 30]) {
    const r = simulateRosterConvergence({ state: real, ps: out.ps, applyPlayerRows: out.apply, clone: out.clone }, n, 3);
    assert.equal(r.ok, true, `${n} aparelhos: ${JSON.stringify(r.problems)}`);
  }
  assert.equal(JSON.stringify(real), before, 'o estado real não pode ser alterado pela simulação');
});
