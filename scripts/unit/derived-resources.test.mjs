import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

function extract(src, marker) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker);
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error('chaves não fecham');
}

const names = ['clamp', 'campaignResourceMax', 'derivedMax', 'effectiveAttr', 'classBonusMap', 'characterRules',
  'combatRules', 'derivedCombat', 'syncDerivedResources', 'resourceSnapshot', 'growResources'];
const body = names.map(n => extract(app, `function ${n}(`)).join('\n');
const api = new Function(`
  const MAX_ATTR = 8, WEAKENED_PENALTY = 2;
  const COMBAT_DEFAULT = {atkMult:4,defMult:5,atkMin:0,defMin:0,atkCap:10,defCap:15};
  const DEFAULT_RULES = {campaign:{attrPoints:8,skillPoints:15,hpMax:45},slasher:{attrPoints:30,skillPoints:30,hpMax:100}};
  const CLASS_BONUSES_DEFAULTS_V107 = {Guerreiro:{Corpo:2,Determinação:1},Herege:{Determinação:2,Sanidade:2}};
  const state = {};
  ${body}
  return {derivedMax, derivedCombat, syncDerivedResources, resourceSnapshot, growResources};
`)();

const mk = (attrs, extra = {}) => ({ login: 'x', campaignType: 'campaign', attrs, conditions: [], ...extra });

test('Vida segue o Corpo e Sanidade segue a Sanidade (curva 25 + 4 por ponto, máximo 45)', () => {
  const p = mk({ Corpo: 4, Sanidade: 2 });
  assert.equal(api.derivedMax(p, 'Corpo'), 41);
  assert.equal(api.derivedMax(p, 'Sanidade'), 33);
});

test('o bônus de classe entra na soma (Guerreiro +2 Corpo; Herege +2 Sanidade)', () => {
  assert.equal(api.derivedMax(mk({ Corpo: 1 }, { class: 'Guerreiro' }), 'Corpo'), 37);
  assert.equal(api.derivedMax(mk({ Sanidade: 1 }, { class: 'Herege' }), 'Sanidade'), 37);
});

test('Ataque = Corpo × 4 (máx. 10) e Defesa = Corpo × 5 (máx. 15), com o Debilitado tirando 2', () => {
  assert.deepEqual([api.derivedCombat(mk({ Corpo: 1 })).atk, api.derivedCombat(mk({ Corpo: 1 })).def], [4, 5]);
  assert.deepEqual([api.derivedCombat(mk({ Corpo: 2 })).atk, api.derivedCombat(mk({ Corpo: 2 })).def], [8, 10]);
  assert.deepEqual([api.derivedCombat(mk({ Corpo: 5 })).atk, api.derivedCombat(mk({ Corpo: 5 })).def], [10, 15]);
  const weak = api.derivedCombat(mk({ Corpo: 2 }, { conditions: ['weakened'] }));
  assert.deepEqual([weak.atk, weak.def], [6, 8]);
});

test('ao subir Corpo e Sanidade, a Vida e a Sanidade atuais ganham a diferença', () => {
  const p = mk({ Corpo: 1, Sanidade: 1 }, { hp: 10, sanity: 5 });
  api.syncDerivedResources(p);
  const before = api.resourceSnapshot(p);
  p.attrs = { Corpo: 3, Sanidade: 2 };
  api.growResources(p, before);
  api.syncDerivedResources(p);
  assert.equal(p.hpMax, 37);
  assert.equal(p.hp, 10 + (37 - 29));
  assert.equal(p.sanityMax, 33);
  assert.equal(p.sanity, 5 + (33 - 29));
});

test('ao reduzir, a Vida atual não passa do novo máximo e nada ganha pontos', () => {
  const p = mk({ Corpo: 5, Sanidade: 5 }, { hp: 45, sanity: 40 });
  api.syncDerivedResources(p);
  const before = api.resourceSnapshot(p);
  p.attrs = { Corpo: 2, Sanidade: 2 };
  api.growResources(p, before);
  api.syncDerivedResources(p);
  assert.equal(p.hp, 33);
  assert.equal(p.sanity, 33);
});

test('a ficha mostra a prévia ao vivo e o texto não fala mais em máximo de 35', () => {
  assert.match(app, /id="derivedPreview"/);
  assert.match(app, /if\(g\.sel==='\.pAttr'&&typeof updateDerivedPreview==='function'\)updateDerivedPreview\(p\)/);
  assert.doesNotMatch(app, /Máximo de 35\./);
});
