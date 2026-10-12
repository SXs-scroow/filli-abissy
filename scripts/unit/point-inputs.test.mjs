// Campos de pontos no celular (V1.5.3): digitar sobre valor já preenchido, campo vazio, botões − / + e limites.
// Usa as funções REAIS do app.js com um DOM de mentira (só o que bindPointInputs toca).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractFunction } from '../chaos/extract-app.mjs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const NEEDED = ['normalizePointText', 'allowedPointValue', 'pointField', 'bindPointInputs'];

class El {
  constructor(value = '') { this.value = String(value); this.dataset = {}; this.l = {}; this.parent = null; this.textContent = ''; this.dispatched = 0; }
  addEventListener(t, f) { (this.l[t] ||= []).push(f); }
  fire(t, e = {}) { (this.l[t] || []).forEach(f => f({ preventDefault() {}, ...e })); }
  closest() { return this.parent; }
  select() {} setSelectionRange() {} blur() { this.fire('blur'); }
  // Simula o jogador: toca no campo (seleciona tudo ou não) e digita
  type(text, { appendToExisting = false } = {}) { this.fire('focus'); this.value = (appendToExisting ? this.value : '') + text; this.fire('input'); }
}
function ctl(input, minus, plus) {
  const c = { querySelectorAll: () => [minus, plus] }; input.parent = c;
  minus.dataset.ptStep = '-1'; plus.dataset.ptStep = '1';
  return c;
}
function build({ attrLimit = 8, max = 8, initial = [0, 0, 0, 0] } = {}) {
  const inputs = initial.map(v => new El(v));
  const btns = inputs.map(i => { const m = new El(), p = new El(); ctl(i, m, p); return { m, p }; });
  const out = new El();
  const toasts = []; let drafts = 0;
  const ctx = vm.createContext({ JSON, Date, Math, Number, String, Array, Object, console, MAX_ATTR: max, MAX_SKILL: 15,
    esc: s => String(s), toast: m => toasts.push(m), setTimeout: f => f(),
    characterRules: () => ({ attrPoints: attrLimit, skillPoints: 15 }),
    document: { querySelectorAll: sel => sel === '.pAttr' ? inputs : [], getElementById: id => id === 'attrRemaining' ? out : null } });
  vm.runInContext(`${NEEDED.map(n => extractFunction(src, n)).join('\n')}
    globalThis.api={bind:(p,cap)=>bindPointInputs(p,cap),norm:normalizePointText,allow:allowedPointValue,field:pointField};`, ctx);
  ctx.api.bind({ campaignType: 'campaign', attrBonusPoints: 0 }, () => { drafts++; });
  return { inputs, btns, out, toasts, drafts: () => drafts, api: ctx.api };
}

test('normalizePointText: só dígitos, sem zeros à esquerda, vazio vira null', () => {
  const { api } = build();
  assert.equal(api.norm('', 8), null);
  assert.equal(api.norm('abc', 8), null);
  assert.equal(api.norm('05', 8), 5);
  assert.equal(api.norm('3,5', 8), 35 > 8 ? 8 : 35);
  assert.equal(api.norm('99', 8), 8);
  assert.equal(api.norm('-4', 8), 4);
});

test('"2" + digitar "3" (sem selecionar) vira 3, não 23 nem "todos os pontos restantes"', () => {
  const { api } = build();
  assert.equal(api.norm('23', 8, '2'), 3);
  assert.equal(api.norm('16', 15, '1'), 6);
  assert.equal(api.norm('12', 15, '1'), 12, 'valor válido de 2 dígitos continua valendo');
});

test('allowedPointValue respeita o máximo do campo e os pontos que sobram', () => {
  const { api } = build();
  assert.equal(api.allow(7, 8, 5, 8), 3);
  assert.equal(api.allow(9, 8, 0, 30), 8);
  assert.equal(api.allow(4, 8, 9, 8), 0, 'nunca negativo');
});

test('digitar sobre campo cheio: troca o valor e atualiza "Restam"', () => {
  const t = build({ initial: [2, 2, 0, 0] });
  t.inputs[0].type('3');
  assert.equal(t.inputs[0].value, '3');
  assert.equal(t.out.textContent, 'Restam 3');
  assert.ok(t.drafts() > 0, 'rascunho é salvo a cada mudança');
});

test('campo vazio enquanto digita não vira 0 à força; ao sair do campo vira 0', () => {
  const t = build({ initial: [3, 0, 0, 0] });
  t.inputs[0].value = ''; t.inputs[0].fire('input');
  assert.equal(t.inputs[0].value, '');
  assert.equal(t.out.textContent, 'Restam 8');
  t.inputs[0].blur();
  assert.equal(t.inputs[0].value, '0');
});

test('vírgula/ponto/letra não deixam o campo "preso": vira só os dígitos', () => {
  const t = build();
  t.inputs[1].value = '4,'; t.inputs[1].fire('input');
  assert.equal(t.inputs[1].value, '4');
});

test('é possível gastar TODOS os pontos (8/8) e não passa disso', () => {
  const t = build({ initial: [0, 0, 0, 0] });
  t.inputs[0].type('5'); t.inputs[1].type('3');
  assert.equal(t.out.textContent, 'Restam 0');
  t.inputs[2].type('4');
  assert.equal(t.inputs[2].value, '0', 'sem pontos sobrando, o campo não aceita');
  assert.ok(t.toasts.length >= 1, 'o jogador é avisado');
  assert.equal(t.inputs.reduce((a, i) => a + Number(i.value), 0), 8);
});

test('digitar mais do que sobra preenche só o que sobra', () => {
  const t = build({ initial: [5, 0, 0, 0] });
  t.inputs[1].type('7');
  assert.equal(t.inputs[1].value, '3');
});

test('botões + e − funcionam, param no limite e no zero', () => {
  const t = build({ initial: [7, 0, 0, 0] });
  t.btns[0].p.fire('click');
  assert.equal(t.inputs[0].value, '8');
  t.btns[0].p.fire('click');
  assert.equal(t.inputs[0].value, '8', 'máximo do campo');
  t.btns[1].p.fire('click');
  assert.equal(t.inputs[1].value, '0', 'sem pontos sobrando');
  t.btns[0].m.fire('click'); t.btns[0].m.fire('click');
  assert.equal(t.inputs[0].value, '6');
  t.btns[1].p.fire('click'); t.btns[1].p.fire('click'); t.btns[1].p.fire('click');
  assert.equal(t.inputs[1].value, '2');
  t.btns[2].m.fire('click');
  assert.equal(t.inputs[2].value, '0', 'nunca negativo');
});

test('pointField escapa o nome e usa teclado numérico', () => {
  const { api } = build();
  const html = api.field('pAttr', 'attr', 'Corpo', 3, 8);
  assert.match(html, /inputmode="numeric"/);
  assert.match(html, /type="text"/);
  assert.match(html, /value="3"/);
  assert.match(html, /data-attr="Corpo"/);
});
