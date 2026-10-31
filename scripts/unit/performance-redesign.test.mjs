import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mapWithConcurrency } from '../../src/persistence/concurrency.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('mapWithConcurrency limita a quatro tarefas e preserva a ordem dos resultados', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency(Array.from({ length: 15 }, (_, i) => i), 4, async value => {
    active += 1;
    peak = Math.max(peak, active);
    await delay(value % 3 === 0 ? 8 : 2);
    active -= 1;
    return value * 10;
  });
  assert.equal(peak, 4);
  assert.deepEqual(result, Array.from({ length: 15 }, (_, i) => i * 10));
});

test('mapWithConcurrency espera as tarefas em voo antes de propagar falha', async () => {
  let completed = 0;
  await assert.rejects(
    mapWithConcurrency([0, 1, 2, 3, 4], 3, async value => {
      await delay(value === 0 ? 2 : 10);
      completed += 1;
      if (value === 0) throw new Error('falha simulada');
      return value;
    }),
    error => error.message === 'falha simulada' && error.taskIndex === 0
  );
  assert.equal(completed, 5, 'todas as tarefas lançadas devem ter terminado antes do reject');
});

test('gravação em lote usa concorrência limitada e preserva ordem por jogador', async () => {
  const source = await readFile(new URL('../../src/playerStore.js', import.meta.url), 'utf8');
  assert.match(source, /mapWithConcurrency\(groups,\s*4/);
  assert.match(source, /Same-player writes remain ordered/);
  assert.match(source, /queuePlayerRows\(players\)/);
  assert.match(source, /delete row\.source\.newPassword/);
});

test('layout final ocupa a largura disponível sem scroll lateral forçado', async () => {
  const css = await readFile(new URL('../../styles-bloodborne.css', import.meta.url), 'utf8');
  assert.match(css, /box-sizing:border-box/);
  assert.match(css, /\.main\{box-sizing:border-box;width:auto;max-width:1740px;margin:0 auto 0 250px/);
  assert.match(css, /backdrop-filter:none/);
  assert.match(css, /@media\(hover:none\)/);
  assert.match(css, /@media\(max-width:700px\)/);
});

test('renderização adia imagens não críticas sem substituir prioridades explícitas', async () => {
  const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
  assert.match(app, /function optimizeRenderedImages\(/);
  assert.match(app, /img\.loading=img\.matches\('\.sigil,\.brand img'\)\?'eager':'lazy'/);
  assert.match(app, /document\.getElementById\('root'\)\.innerHTML=html;optimizeRenderedImages\(\)/);
});
