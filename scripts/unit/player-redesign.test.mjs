import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('redesign uses the intended black, wine and blood-red palette', () => {
  assert.match(css, /--bg:#080608/);
  assert.match(css, /--red:#6e0b1c/);
  assert.match(css, /--red2:#b31830/);
  assert.match(css, /--red3:#ed334b/);
});

test('redesign selectors exclude the Master shell', () => {
  assert.match(css, /\.shell:not\(\.shell-master\) \.op-home-sheet/);
  assert.match(css, /\.shell:not\(\.shell-master\) \.profile-header/);
  assert.match(css, /\.shell:not\(\.shell-master\) \.sheet-card/);
});

test('important character editing and inventory hooks remain present', () => {
  for (const id of ['saveIdentity', 'saveAttrs', 'saveSkills', 'addBagItem', 'photoInput', 'downloadSheetPdf']) {
    assert.ok(app.includes(`id="${id}"`), `missing existing UI hook: ${id}`);
  }
});

test('presentation copy changed without removing player resource and point controls', () => {
  assert.match(app, /SANGUE RESTANTE/);
  assert.match(app, /SANIDADE RESTANTE/);
  assert.match(app, /ATRIBUTOS DO PORTADOR/);
  assert.match(app, /PERÍCIAS DOMINADAS/);
  assert.match(app, /PERTENCES RECUPERADOS/);
  assert.match(app, /Os ossos ainda não deixaram um registro/);
  assert.match(app, /data-resource-input/);
  assert.match(app, /function bindSheet\(/);
});

test('reduced-motion preference is respected by redesign CSS', () => {
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[\s\S]*\.shell:not\(\.shell-master\)/);
});
