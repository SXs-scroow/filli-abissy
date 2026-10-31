import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const css = fs.readFileSync(path.join(root, 'styles-bloodborne.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('tema visual é carregado depois da folha base sem substituir os controladores da aplicação', () => {
  assert.match(main, /import '\.\.\/styles\.css';\s*import '\.\.\/styles-bloodborne\.css';/);
  assert.match(shell, /function shell\(content,active='home'\)/);
  assert.match(shell, /data-nav="sheet"/);
  assert.match(shell, /data-nav="master"/);
  assert.match(shell, /data-nav="map"/);
});

test('menu lateral gótico inclui adaptação mobile para navegação horizontal', () => {
  assert.match(css, /\.topbar\s*\{[^}]*position:fixed;inset:0 auto 0 0;width:250px/s);
  assert.match(css, /\.nav\s*\{[^}]*flex-direction:column/s);
  assert.match(css, /@media\(max-width:980px\)\s*\{[\s\S]*?\.topbar\s*\{position:sticky/);
  assert.match(css, /\.nav\s*\{[^}]*flex-direction:row/s);
});

test('tema cobre tela de entrada e superfícies internas sem remover estados de alerta', () => {
  for (const selector of ['.screen{', '.login-card{', '.main{', '.main-sheet{', '.card,', '.master-player-card', '.ashen-fs', '.btn.danger']) {
    assert.ok(css.includes(selector), `seletor visual ausente: ${selector}`);
  }
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});
