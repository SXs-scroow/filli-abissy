// Contagem de pontos: chaves órfãs não gastam pontos e rascunho velho não sobrepõe os pontos reais.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractFunction } from '../chaos/extract-app.mjs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const NEEDED = ['characterRules', 'activeSheetDraft', 'allocationValues', 'allocationTotals', 'allocationRemaining', 'validateAllocation'];

function sandbox(player, draft) {
  const ctx = vm.createContext({ JSON, Date, Math, Map, Set, Object, Array, String, Number, console,
    DEFAULT_RULES: { campaign: { attrPoints: 8, skillPoints: 15 }, slasher: { attrPoints: 30, skillPoints: 30 } },
    allAttrs: () => ['Corpo', 'Mente'], allSkills: () => ['Furtividade', 'Luta'],
    state: { characterRules: null, session: { role: 'player', playerId: player.id, sheetDraft: draft || null } } });
  vm.runInContext(`${NEEDED.map(n => extractFunction(src, n)).join('\n')}
    globalThis.api={tot:e=>allocationTotals(e),rem:e=>allocationRemaining(e),val:e=>validateAllocation(e),get draft(){return state.session.sheetDraft}};`, ctx);
  return ctx.api;
}

test('atributo órfão (sem campo na tela) não conta contra o limite', () => {
  const p = { id: 'p1', attrs: { Corpo: 3, Mente: 2, Removido: 6 }, skills: {} };
  const api = sandbox(p);
  assert.equal(api.tot(p).attrs, 5);
  assert.equal(api.rem(p).attrs, 3);
  assert.equal(api.val(p), '');
});

test('rascunho antigo (sem dono/expirado) é descartado e não sobrepõe os pontos salvos', () => {
  const p = { id: 'p1', attrs: { Corpo: 1, Mente: 1 }, skills: {}, _pointsAt: 50 };
  const api = sandbox(p, { attrs: { Corpo: 8, Mente: 8 }, skills: {} });
  assert.equal(api.tot(p).attrs, 2);
  assert.equal(api.draft, null);
});

test('rascunho válido do mesmo Player vale; se o Mestre mudar os pontos, ele cai', () => {
  const p = { id: 'p1', attrs: { Corpo: 1, Mente: 1 }, skills: {}, _pointsAt: 50 };
  const ok = { attrs: { Corpo: 4, Mente: 1 }, skills: {}, pid: 'p1', at: Date.now(), basePts: 50 };
  assert.equal(sandbox(p, ok).tot(p).attrs, 5);
  const mestreMexeu = { ...ok, basePts: 10 };
  assert.equal(sandbox(p, mestreMexeu).tot(p).attrs, 2);
});
