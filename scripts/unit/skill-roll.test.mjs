import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

function extract(src, startMarker) {
  const i = src.indexOf(startMarker);
  assert.ok(i >= 0, `não achei ${startMarker}`);
  let depth = 0, j = src.indexOf('){', i) + 1;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error('chaves não fecham');
}
function constLine(name) {
  const m = app.match(new RegExp(`const ${name}=[^\\n]*`));
  assert.ok(m, `não achei const ${name}`);
  return m[0];
}

function build({ mode = 'cris', attrs = {}, skills = {}, heavy = false, dice = [] } = {}) {
  const queue = [...dice];
  const toasts = [];
  const src = [
    constLine('SKILL_ATTR'), constLine('TRAINED_ONLY_SKILLS'), constLine('LOAD_PENALTY_SKILLS'), constLine('LOAD_PENALTY_VALUE'),
    extract(app, 'function skillRollMode'), extract(app, 'function heavyLoad'), extract(app, 'function rollCritClass'),
    'let masterRollLog=[];', 'let rollAdvMode=\'\';', extract(app, 'function setRollAdv'), extract(app, 'function rollPoolD20'),
    extract(app, 'function finishRoll'), extract(app, 'function buildRoll'), extract(app, 'function rollSkillFor'), extract(app, 'function rollAttrFor'),
    'return {rollSkillFor,rollAttrFor,setRollAdv,get log(){return masterRollLog}};'
  ].join('\n');
  const state = { characterRules: { skillRollMode: mode } };
  const api = new Function('state', 'allAttrs', 'effectiveAttr', 'effectiveSkill', 'bagCapacity', 'bagWeight', 'rollOneD20', 'toast', 'cryptoRandomId', 'mergeRollHistory', 'save', 'updateDiceUI',
    src)(state, () => Object.keys(attrs), (p, a) => attrs[a] || 0, (p, s) => skills[s] || 0, () => 10, () => (heavy ? 9 : 2),
    () => queue.shift() ?? 10, m => toasts.push(m), () => 'id', (l, r) => [...(l || []), r], () => {}, () => {});
  return { rollSkillFor: api.rollSkillFor, rollAttrFor: api.rollAttrFor, setRollAdv: api.setRollAdv, getLog: () => api.log, toasts };
}

test('rolagem C.R.I.S.: d20 = atributo ligado, pega o maior e soma a perícia', () => {
  const { rollSkillFor } = build({ attrs: { Agilidade: 3 }, skills: { Furtividade: 5 }, dice: [4, 17, 9] });
  const p = { name: 'Ana', rolls: [] };
  const r = rollSkillFor(p, 'Furtividade');
  assert.equal(r.natural, 17);
  assert.equal(r.value, 22);
  assert.equal(r.rawRolls.length, 3);
});

test('atributo 0 rola 2d20 e fica com o menor', () => {
  const { rollSkillFor } = build({ attrs: { Agilidade: 0 }, skills: { Furtividade: 2 }, dice: [15, 6] });
  const r = rollSkillFor({ rolls: [] }, 'Furtividade');
  assert.equal(r.natural, 6);
  assert.equal(r.value, 8);
});

test('modo simples rola só 1d20 + perícia', () => {
  const { rollSkillFor } = build({ mode: 'simple', attrs: { Agilidade: 5 }, skills: { Luta: 3 }, dice: [11] });
  const r = rollSkillFor({ rolls: [] }, 'Luta');
  assert.equal(r.rawRolls.length, 1);
  assert.equal(r.value, 14);
});

test('perícia só treinada não rola sem treino', () => {
  const { rollSkillFor, toasts } = build({ attrs: { Conhecimento: 2 }, skills: { Ciências: 0 } });
  const p = { rolls: [] };
  assert.equal(rollSkillFor(p, 'Ciências'), null);
  assert.equal(p.rolls.length, 0);
  assert.match(toasts[0], /treino/);
});

test('carga pesada aplica −2 só nas perícias com +', () => {
  const { rollSkillFor } = build({ mode: 'simple', skills: { Furtividade: 4, Luta: 4 }, heavy: true, dice: [10, 10] });
  assert.equal(rollSkillFor({ rolls: [] }, 'Furtividade').value, 12);
  assert.equal(rollSkillFor({ rolls: [] }, 'Luta').value, 14);
});

test('crítico natural, falha crítica e rolagem do Mestre fora do histórico do player', () => {
  const { rollSkillFor, getLog } = build({ mode: 'simple', skills: { Luta: 0 }, dice: [20, 1] });
  const p = { name: 'Bruno', rolls: [] };
  assert.equal(rollSkillFor(p, 'Luta').crit, 'crit');
  assert.equal(rollSkillFor(p, 'Luta', { log: 'master' }).crit, 'fumble');
  assert.equal(p.rolls.length, 1);
  assert.equal(getLog().length, 1);
});

test('vantagem soma 1d20 e volta ao normal depois da rolagem', () => {
  const { rollSkillFor, setRollAdv } = build({ attrs: { Agilidade: 2 }, skills: { Furtividade: 0 }, dice: [3, 8, 19, 5, 5] });
  setRollAdv('adv');
  const r = rollSkillFor({ rolls: [] }, 'Furtividade');
  assert.equal(r.rawRolls.length, 3);
  assert.equal(r.natural, 19);
  const r2 = rollSkillFor({ rolls: [] }, 'Furtividade');
  assert.equal(r2.rawRolls.length, 2);
});

test('desvantagem tira 1d20 e, se zerar, rola 2 e fica com o menor', () => {
  const { rollSkillFor, setRollAdv } = build({ attrs: { Agilidade: 1 }, skills: { Furtividade: 0 }, dice: [18, 4] });
  setRollAdv('dis');
  const r = rollSkillFor({ rolls: [] }, 'Furtividade');
  assert.equal(r.rawRolls.length, 2);
  assert.equal(r.natural, 4);
});

test('modo simples: vantagem = 2d20 maior, desvantagem = 2d20 menor', () => {
  const { rollSkillFor, setRollAdv } = build({ mode: 'simple', skills: { Luta: 1 }, dice: [7, 16, 7, 16] });
  setRollAdv('adv');
  assert.equal(rollSkillFor({ rolls: [] }, 'Luta').value, 17);
  setRollAdv('dis');
  assert.equal(rollSkillFor({ rolls: [] }, 'Luta').value, 8);
});

test('rolagem de atributo: d20 por ponto, pega o maior, sem bônus de perícia', () => {
  const { rollAttrFor } = build({ attrs: { Força: 3 }, dice: [2, 14, 9] });
  const p = { rolls: [] };
  const r = rollAttrFor(p, 'Força');
  assert.equal(r.natural, 14);
  assert.equal(r.value, 14);
  assert.equal(r.modifier, 0);
  assert.equal(p.rolls.length, 1);
});
