import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

function extract(src, startMarker) {
  const i = src.indexOf(startMarker);
  assert.ok(i >= 0, `não achei ${startMarker}`);
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error('chaves não fecham');
}

const ITEMS = {
  1: { id: 1, name: 'Chave', icon: '🗝', weight: 1, category: 'Chaves' },
  2: { id: 2, name: 'Faca', icon: '🔪', weight: 2, category: 'Armas', damage: '1d6' },
  3: { id: 3, name: 'Diário <b>', icon: '📖', weight: 1, category: 'Livros', bookPages: ['x'] },
};

function load(names, extra = '') {
  const code = names.map(n => extract(app, `function ${n}(`)).join('\n');
  return new Function('item', 'inferWeight', 'bagCapacity', 'esc', 'itemIcon', 'isWeaponItem', 'weaponDamageFallback', 'allocationRemaining', 'normalize', 'characterRules', 'allocationOver', 'activePlayersList',
    `${code}\n${extra}\nreturn {${names.join(',')}};`);
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deps = [
  id => ITEMS[id], i => i.weight, () => 6, esc, i => i.icon, i => i.category === 'Armas', () => '1d4',
  () => ({ attrs: 0, skills: 0 }), () => {}, () => ({ attrPoints: 0, skillPoints: 0 }), () => ({ attrs: 0, skills: 0 }), () => [],
];
const bag = load(['bagBookItem', 'bagLayout', 'bagCellsMarkup', 'bagDetailMarkup'])(...deps);

test('mochila: cada item ocupa peso × quantidade quadrados e o total acompanha a capacidade', () => {
  const p = { backpack: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }] };
  const L = bag.bagLayout(p);
  assert.equal(L.used, 4);
  assert.equal(L.cap, 6);
  assert.equal(L.total, 6);
  const html = bag.bagCellsMarkup(p, L.total, 'sq', 'data-pick', '<i class="empty"></i>', 0);
  assert.equal((html.match(/<button/g) || []).length, 4);
  assert.equal((html.match(/class="empty"/g) || []).length, 2);
  assert.equal((html.match(/is-lead/g) || []).length, 2);
  assert.equal((html.match(/is-tail/g) || []).length, 2);
  assert.match(html, /<em>2<\/em>/);
  assert.match(html, /is-sel/);
});

test('mochila: excesso de peso aumenta o grid e marca quadrados fora da capacidade', () => {
  const p = { backpack: [{ id: 2, qty: 4 }] };
  const L = bag.bagLayout(p);
  assert.equal(L.used, 8);
  assert.equal(L.total, 8);
  const html = bag.bagCellsMarkup(p, L.total, 'sq', 'data-pick', '', -1);
  assert.equal((html.match(/is-over/g) || []).length, 2);
});

test('mochila: itens removidos do catálogo são ignorados e o detalhe escapa HTML', () => {
  const p = { backpack: [{ id: 99, qty: 1 }, { id: 3, qty: 1 }] };
  const L = bag.bagLayout(p);
  assert.equal(L.entries.length, 1);
  const detail = bag.bagDetailMarkup(p, 1);
  assert.match(detail, /Diário &lt;b&gt;/);
  assert.match(detail, /data-read-book="3"/);
  assert.match(bag.bagDetailMarkup(p, 0), /Toque em um quadrado/);
});

test('pontos do Mestre: medidor mostra livres, excesso e bônus concedido', () => {
  const fn = load(['pointsMeter', 'pointsStepper'])(...deps);
  const ok = fn.pointsMeter('Atributos', 6, 10, 2);
  assert.match(ok, /6\/10/);
  assert.match(ok, /4 livres/);
  assert.match(ok, /\+2 do Mestre/);
  assert.match(ok, /width:60%/);
  const over = fn.pointsMeter('Perícias', 12, 10, 0);
  assert.match(over, /is-over/);
  assert.match(over, /Excedido em 2/);
  const step = fn.pointsStepper('p-1', 'attr', 'atributo');
  assert.match(step, /data-step-delta="-1"/);
  assert.match(step, /data-step-delta="1"/);
  assert.match(step, /data-step-id="p-1"/);
});

test('modo sessão: aba Mochila e painel usam quadrados e o seletor de item', () => {
  assert.match(app, /imm-bag-grid/);
  assert.match(app, /data-bag-pick/);
  assert.match(app, /data-imm-inv/);
  assert.match(app, /data-points-step/);
  assert.match(app, /id="ptPreview"/);
});
