import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('Vida base de campanha usa a progressão 18, 24, 27 e +9 por ponto a partir de Corpo 3, limitada a 65', () => {
  assert.match(app, /const hp=corpo===0\?18:corpo===1\?24:27\+\(corpo-2\)\*9;return Math\.min\(65,hp\)/);
  assert.match(app, /const MAX_HP=65/);
  assert.match(app, /campaign:\{attrPoints:8,skillPoints:15,hpMax:65\}/);
  assert.match(app, /campaignType==='slasher'\?9999:65/);
  // Sanidade keeps its prior 35-point cap; only Vida changes to 65.
  assert.match(app, /return Math\.min\(35,Math\.max\(0,effectiveAttr\(e,attr\)\*9\)\)/);
});
