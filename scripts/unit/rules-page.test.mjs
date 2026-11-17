import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('a aba Regras abre a página do livro de regras em vez de cair na tela inicial', () => {
  assert.match(app, /data-nav="rules"/);
  assert.match(app, /view==='rules'\?rulesPage\(\)/);
});

test('a política de segurança deixa o PDF do livro aparecer no iframe', () => {
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /frame-src[^;]*https:\/\/\*\.supabase\.co/);
  assert.match(csp, /frame-src[^;]*https:\/\/open\.spotify\.com/);
});

test('a página do livro mantém o botão de abrir em nova aba como alternativa ao iframe', () => {
  const page = app.slice(app.indexOf('function rulesPage()'), app.indexOf('function rulesPage()') + 1500);
  assert.match(page, /Abrir em nova aba/);
  assert.match(page, /rel=\\"noopener\\"|rel="noopener"/);
  assert.match(page, /O Mestre ainda não disponibilizou/);
});
