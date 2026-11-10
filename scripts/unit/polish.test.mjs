import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = p => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const app = read('app.js'), main = read('src/main.js'), css = read('styles-polish.css');
test('polimento: CSS carregado por último e landmark principal acessível', () => {
  assert.ok(main.indexOf("styles-polish.css") > main.indexOf("styles-session.css"));
  assert.match(app, /id="main-content" tabindex="-1"/);
  assert.match(app, /data-skip-main/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /pointer:coarse/);
  assert.match(css, /prefers-reduced-motion/);
});
test('bug: fallback de imagem não usa handler inline (bloqueado pelo CSP)', () => {
  assert.match(app, /document\.addEventListener\('error'/);
  assert.match(app, /window\.__a11yPolishBound/);
});
