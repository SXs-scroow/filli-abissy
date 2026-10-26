import test from 'node:test';
import assert from 'node:assert/strict';
import { corruptText, corruptName, buildTerminalModel, terminalDesktopMarkup, bootLines, bootTimeline } from '../../src/terminalKit.js';

const txt = 'A chave do cofre está atrás do retrato.\nNão confie no zelador.';

test('corrupção é determinística e respeita os níveis', () => {
  assert.equal(corruptText(txt, 'partial', 's1'), corruptText(txt, 'partial', 's1'));
  assert.notEqual(corruptText(txt, 'partial', 's1'), corruptText(txt, 'partial', 's2'));
  assert.equal(corruptText(txt, 'partial', 's1').split('\n').length, 2);
  assert.doesNotMatch(corruptText(txt, 'total', 's1'), /cofre|zelador/);
  assert.equal(corruptName('carta.txt', 'severe', 'k').endsWith('.txt'), true);
});

test('modelo do filesystem agrupa arquivos e marca corrompidos', () => {
  const m = buildTerminalModel('p', { title: 'R', content: 'x', audioFiles: [{ name: 'a.mp3', corrupted: true, corruptMode: 'dead' }],
    extraFiles: [{ id: '1', name: 'c.txt', folder: 'evidence', corrupted: true, level: 'severe', shown: '▒▒' }, { id: '2', name: 'd.txt', folder: 'nope', content: 'ok' }] });
  assert.equal(m.corruptedCount, 2);
  assert.equal(m.byKey.get('x:2').folder, 'evidence');
  assert.equal(m.byKey.get('audio:0').mode, 'dead');
  assert.equal(m.rootItems[0].key, 'secret');
});

test('boot: linha do tempo crescente e markup escapado', () => {
  const m = buildTerminalModel('p', { title: 'R', content: 'x' });
  const tl = bootTimeline(bootLines(m, 'X').length);
  assert.ok(tl.times.every((t, i) => i === 0 || t > tl.times[i - 1]));
  assert.ok(tl.logoAt < tl.grantAt && tl.grantAt < tl.outAt && tl.outAt < tl.total);
  const html = terminalDesktopMarkup({ id: 'p', terminalLabel: '<img src=x>' }, { title: '<b>', content: 'x' }, { booting: true, bootElapsed: 100 });
  assert.doesNotMatch(html, /<img src=x>/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /--el:100/);
});
