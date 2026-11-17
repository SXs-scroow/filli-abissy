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

test('Vida (Corpo) e Sanidade seguem a curva uniforme 25 + 4 por ponto, máximo 45', () => {
  const max = new Function(`${extract(app, 'function campaignResourceMax')}; return campaignResourceMax;`)();
  assert.equal(max(0), 25);
  assert.equal(max(1), 29);
  assert.equal(max(2), 33);
  assert.equal(max(3), 37);
  assert.equal(max(4), 41);
  assert.equal(max(5), 45);
  assert.equal(max(6), 45);
  assert.equal(max(8), 45);
});

test('derivedMax usa a tabela para Corpo e Sanidade da campanha; Slasher mantém a fórmula própria', () => {
  assert.match(app, /return campaignResourceMax\(corpo\)\}if\(attr==='Sanidade'&&e\?\.campaignType!=='slasher'\)return campaignResourceMax\(/);
  assert.match(app, /e\?\.campaignType==='slasher'\)return Math\.min\(9999,Math\.max\(Number\(r\.hpMax\)\|\|1,corpo\*9\)\)/);
  assert.match(app, /const MAX_HP=45/);
  assert.match(app, /campaign:\{attrPoints:8,skillPoints:15,hpMax:45\}/);
  assert.match(app, /campaignType==='slasher'\?9999:45/);
  assert.doesNotMatch(app, /campaignType==='slasher'\?9999:65/);
});

test('monstros nunca são recalculados pela fórmula de Player', () => {
  assert.match(app, /if\(isMonsterEntity\)\{delete e\.login;delete e\.password\}/);
});
