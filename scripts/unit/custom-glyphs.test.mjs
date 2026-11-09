import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
function extract(name) {
  const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name);
  let d = 0;
  for (let k = app.indexOf('{', i); k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(i, k + 1); }
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const code = ['safeGlyphPath', 'parseCustomGlyph', 'customGlyphList', 'customGlyphHtml', 'customGlyphRender'].map(extract).join('\n');
const make = glyphs => new Function('state', 'esc', 'renderCustomIcon', `${code}\nreturn {safeGlyphPath,customGlyphList,customGlyphHtml};`)({ uiIcons: { sessionGlyphs: glyphs } }, esc, v => esc(v));
test('símbolo desenhado renderiza como SVG e é sanitizado', () => {
  const m = make({ a: JSON.stringify({ name: 'Runa', type: 'path', value: 'M4 4 L20 20', stroke: 1.6 }), b: JSON.stringify({ name: 'x', type: 'path', value: 'M0 0"><script>alert(1)</script>' }), c: JSON.stringify({ deleted: true }) });
  assert.match(m.customGlyphHtml('a'), /<svg[^>]*><path d="M4 4 L20 20"/);
  assert.doesNotMatch(m.customGlyphHtml('b'), /script/);
  assert.equal(m.customGlyphList().length, 2);
  assert.equal(m.customGlyphHtml('c'), '◇');
  assert.equal(m.customGlyphHtml('inexistente'), '◇');
  assert.equal(m.customGlyphHtml('constructor'), '◇');
});
test('símbolos próprios sincronizam via uiIcons.sessionGlyphs', () => {
  assert.equal((app.match(/'sessionTheme','sessionGlyphs'/g) || []).length, 3);
  assert.match(app, /data-sg-save/);
  assert.match(app, /startsWith\('sym:'\)/);
});
test('mochila tem arrastar por toque (pressão longa) e rolagem preservada', () => {
  assert.match(app, /addEventListener\('pointerdown'/);
  assert.match(app, /imm-ghost/);
  assert.match(app, /touchmove',blockScroll,\{passive:false\}/);
  assert.match(app, /navigator\.vibrate/);
  assert.match(app, /window\.scrollTo\(0,y\)/);
});
test('segurança: campo "effects" (do Mestre) não é exibido ao Player na mochila', () => {
  const i = app.indexOf('function bagDetailMarkup(');
  const body = app.slice(i, app.indexOf('function immCornersMarkup'));
  assert.doesNotMatch(body, /\.effects/);
  assert.doesNotMatch(body, /imm-detail-fx/);
});
test('segurança: arrastar por toque não usa innerHTML', () => {
  const i = app.indexOf('function bindImmBag(');
  const body = app.slice(i, app.indexOf('let sessThemeDraft'));
  assert.doesNotMatch(body, /\.innerHTML=c\.querySelector/);
});
