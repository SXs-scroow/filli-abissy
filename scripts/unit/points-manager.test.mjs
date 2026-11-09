import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

function extract(marker) {
  const i = app.indexOf(marker);
  assert.ok(i >= 0, `não achei ${marker}`);
  let depth = 0;
  for (let k = app.indexOf('{', i); k < app.length; k++) {
    if (app[k] === '{') depth++;
    else if (app[k] === '}' && --depth === 0) return app.slice(i, k + 1);
  }
  throw new Error('chaves não fecham');
}

class FakeEl {
  constructor(props = {}) { Object.assign(this, { value: '', checked: false, disabled: false, innerHTML: '', dataset: {}, listeners: {}, classList: { toggle() {}, add() {}, remove() {} } }, props); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  querySelectorAll(sel) { return sel === '[data-chip]' ? this.chips : []; }
  remove() {}
}

function setup(players, { syncOk = true, confirmAnswer = true } = {}) {
  const els = {};
  ['closePoints', 'ptClose2', 'ptAll', 'ptNone', 'ptApply', 'ptMode', 'ptAttr', 'ptSkill', 'ptReset', 'ptPreview', 'pointsRows', 'pointsSummary']
    .forEach(id => { els[id] = new FakeEl(); });
  els.ptMode.value = 'add';
  const picks = new Map(), steps = [], refunds = new Map();
  const chipBoxes = ['ptAttr', 'ptSkill'].map(id => {
    const box = new FakeEl({ dataset: { chipsFor: id } });
    box.chips = [1, 2, 3, 5].map(n => new FakeEl({ dataset: { chip: String(n) } }));
    return box;
  });
  const toasts = [], persisted = [];
  const doc = {
    getElementById: id => els[id] || null,
    querySelectorAll(sel) {
      if (sel === '[data-points-pick]') return players.map(p => picks.get(String(p.id)) || picks.set(String(p.id), new FakeEl({ dataset: { pointsPick: String(p.id) } })).get(String(p.id)));
      if (sel === '[data-points-pick]:checked') return doc.querySelectorAll('[data-points-pick]').filter(x => x.checked);
      if (sel === '[data-points-step]') {
        if (!steps.length) players.forEach(p => ['attr', 'skill'].forEach(k => [-1, 1].forEach(d => steps.push(new FakeEl({ dataset: { stepId: String(p.id), stepKind: k, stepDelta: String(d) } })))));
        return steps;
      }
      if (sel === '[data-points-refund]') return players.map(p => refunds.get(p.id) || refunds.set(p.id, new FakeEl({ dataset: { pointsRefund: String(p.id) } })).get(p.id));
      if (sel === '[data-chips-for]') return chipBoxes;
      return [];
    },
  };
  const state = { players, characterRules: { campaign: { attrPoints: 4, skillPoints: 6 } } };
  const env = {
    document: doc, state, esc: x => String(x), toast: m => toasts.push(m), confirm: () => confirmAnswer,
    normalize: () => {}, activePlayersList: () => players,
    allAttrs: () => ['forca', 'agilidade'], allSkills: () => ['luta', 'furtividade'],
    allocationValues: e => ({ attrs: e.attrs || {}, skills: e.skills || {} }),
    DEFAULT_RULES: { campaign: { attrPoints: 4, skillPoints: 6 } },
    persistPointChanges: async list => { persisted.push(list.map(p => p.id)); return syncOk; },
    openModal: () => {},
  };
  const code = ['characterRules', 'allocationTotals', 'allocationOver', 'allocationRemaining', 'zeroPlayerPoints', 'pointsMeter', 'pointsStepper', 'pointsSummaryMarkup', 'pointsManagerRows', 'bindPointsManager']
    .map(n => extract(n === 'persistPointChanges' ? 'async function persistPointChanges' : `function ${n}(`)).join('\n');
  const api = new Function('env', `with(env){${code}\nreturn {bindPointsManager,pointsManagerRows,pointsSummaryMarkup};}`)(env);
  api.bindPointsManager();
  return { els, picks, steps, doc, toasts, persisted, api, pick: id => { doc.querySelectorAll('[data-points-pick]').find(x => x.dataset.pointsPick === id).checked = true; } };
}

const mk = () => [
  { id: 'a', name: 'Ana', attrBonusPoints: 0, skillBonusPoints: 0, attrs: { forca: 2 }, skills: {} },
  { id: 'b', name: 'Bruno', attrBonusPoints: 3, skillBonusPoints: 1, attrs: { forca: 4, agilidade: 3 }, skills: { luta: 2 } },
];

test('pontos do Mestre: dar pontos aos marcados atualiza só eles e salva uma vez', async () => {
  const players = mk(), t = setup(players);
  t.pick('a');
  t.els.ptAttr.value = '2'; t.els.ptSkill.value = '1';
  await t.els.ptApply.onclick();
  assert.equal(players[0].attrBonusPoints, 2);
  assert.equal(players[0].skillBonusPoints, 1);
  assert.equal(players[1].attrBonusPoints, 3);
  assert.deepEqual(t.persisted, [['a']]);
  assert.match(t.toasts.at(-1), /1 Player/);
});

test('pontos do Mestre: retirar nunca fica negativo e definir total funciona', async () => {
  const players = mk(), t = setup(players);
  t.pick('a'); t.pick('b');
  t.els.ptMode.value = 'remove'; t.els.ptAttr.value = '10';
  await t.els.ptApply.onclick();
  assert.equal(players[0].attrBonusPoints, 0);
  assert.equal(players[1].attrBonusPoints, 0);
  t.els.ptMode.value = 'set'; t.els.ptAttr.value = '5'; t.els.ptSkill.value = '';
  await t.els.ptApply.onclick();
  assert.equal(players[0].attrBonusPoints, 5);
  assert.equal(players[1].attrBonusPoints, 5);
  assert.equal(players[1].skillBonusPoints, 1, 'perícia em branco não muda');
});

test('pontos do Mestre: valida marcados, valores vazios e mudança nula sem chamar o servidor', async () => {
  const players = mk(), t = setup(players);
  t.els.ptAttr.value = '2';
  await t.els.ptApply.onclick();
  assert.match(t.toasts.at(-1), /Marque pelo menos um Player/);
  t.pick('a'); t.els.ptAttr.value = ''; t.els.ptSkill.value = '';
  await t.els.ptApply.onclick();
  assert.match(t.toasts.at(-1), /Informe quantos pontos/);
  t.els.ptAttr.value = '0';
  await t.els.ptApply.onclick();
  assert.match(t.toasts.at(-1), /Nada mudou/);
  assert.equal(t.persisted.length, 0);
});

test('pontos do Mestre: retirar abaixo do gasto avisa; opção de zerar devolve a distribuição', async () => {
  const players = mk(), t = setup(players);
  t.pick('b');
  t.els.ptMode.value = 'remove'; t.els.ptAttr.value = '3';
  await t.els.ptApply.onclick();
  assert.equal(players[1].attrBonusPoints, 0);
  assert.match(t.toasts.at(-1), /Acima do limite: Bruno/);
  assert.equal(players[1].attrs.forca, 4, 'sem a opção, o gasto do Player é preservado');
  t.pick('b'); t.els.ptMode.value = 'add'; t.els.ptAttr.value = '0';
  t.els.ptMode.value = 'remove'; t.els.ptAttr.value = '1'; t.els.ptSkill.value = ''; players[1].attrBonusPoints = 1;
  t.els.ptReset.checked = true;
  await t.els.ptApply.onclick();
  assert.equal(players[1].attrs.forca, 0);
  assert.equal(players[1].attrs.agilidade, 0);
  assert.equal(players[1].skills.luta, 2, 'perícias não são zeradas quando só atributo ficou acima');
});

test('pontos do Mestre: botões −/+ ajustam 1 ponto, respeitam o zero e avisam quando só salvou local', async () => {
  const players = mk(), t = setup(players, { syncOk: false });
  const btn = (id, kind, d) => t.doc.querySelectorAll('[data-points-step]').find(b => b.dataset.stepId === id && b.dataset.stepKind === kind && b.dataset.stepDelta === String(d));
  await btn('a', 'attr', 1).onclick();
  assert.equal(players[0].attrBonusPoints, 1);
  assert.match(t.toasts.at(-1), /Salvo neste aparelho/);
  await btn('a', 'skill', -1).onclick();
  assert.equal(players[0].skillBonusPoints, 0);
  assert.match(t.toasts.at(-1), /não tem pontos concedidos/);
  assert.equal(t.persisted.length, 1);
  await btn('b', 'skill', -1).onclick();
  assert.equal(players[1].skillBonusPoints, 0);
});

test('pontos do Mestre: devolver pontos gastos pede confirmação e zera atributos e perícias', async () => {
  const players = mk(), t = setup(players, { confirmAnswer: false });
  const refund = id => t.doc.querySelectorAll('[data-points-refund]').find(b => b.dataset.pointsRefund === id);
  await refund('b').onclick();
  assert.equal(players[1].attrs.forca, 4, 'cancelar não altera nada');
  const t2 = setup(players);
  await t2.doc.querySelectorAll('[data-points-refund]').find(b => b.dataset.pointsRefund === 'b').onclick();
  assert.equal(players[1].attrs.forca, 0);
  assert.equal(players[1].skills.luta, 0);
  assert.equal(players[1].attrBonusPoints, 3, 'bônus concedido continua');
});

test('pontos do Mestre: prévia e botão Aplicar refletem o que falta preencher', () => {
  const players = mk(), t = setup(players);
  assert.equal(t.els.ptApply.disabled, true);
  assert.match(t.els.ptPreview.innerHTML, /Marque os Players/);
  t.pick('a');
  t.els.ptAttr.listeners.input();
  assert.match(t.els.ptPreview.innerHTML, /Informe os pontos/);
  t.els.ptAttr.value = '2';
  t.els.ptAttr.listeners.input();
  assert.equal(t.els.ptApply.disabled, false);
  assert.match(t.els.ptPreview.innerHTML, /\+2 de Atributo/);
  t.els.ptMode.value = 'remove';
  t.els.ptMode.listeners.change();
  assert.match(t.els.ptPreview.innerHTML, /−2 de Atributo/);
});

test('pontos do Mestre: resumo e linhas calculam livres/excesso corretamente', () => {
  const players = mk();
  players[1].attrs.forca = 6;
  const t = setup(players);
  const rows = t.api.pointsManagerRows();
  assert.match(rows, /2\/4/);
  assert.match(rows, /9\/7/);
  assert.match(rows, /Excedido em 2/);
  assert.match(rows, /Acima do limite|Excedido/);
  const sum = t.api.pointsSummaryMarkup();
  assert.match(sum, /\+3/);
  assert.match(sum, /Acima do limite/);
});
