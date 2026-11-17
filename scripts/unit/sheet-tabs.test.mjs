import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

function sheetKickers() {
  const start = app.indexOf('function sheetInternal(){');
  const end = app.indexOf('function slots(p,editable=false){', start);
  const body = app.slice(start, end);
  return [...body.matchAll(/section-kicker">([^<$]+)</g)].map(m => m[1].trim().toUpperCase());
}
function mappedKickers() {
  const m = /const SHEET_TAB_BY_KICKER=\{([^}]+)\}/.exec(app);
  assert.ok(m, 'mapa SHEET_TAB_BY_KICKER não encontrado');
  return new Set([...m[1].matchAll(/'([^']+)':/g)].map(x => x[1]));
}

test('ficha: todo card da ficha tem aba definida (novos cards não caem sem querer em "Essencial")', () => {
  const mapped = mappedKickers();
  // CLASSE ATUAL e RESUMO ficam na coluna lateral (sempre junto de "Essencial").
  const side = new Set(['CLASSE ATUAL', 'RESUMO']);
  const missing = sheetKickers().filter(k => !mapped.has(k) && !side.has(k));
  assert.deepEqual(missing, [], `cards sem aba: ${missing.join(', ')}`);
});

test('ficha: abas, barra fixa e rolagem rápida estão ligadas ao render da ficha', () => {
  assert.match(app, /bindSheet\(\);try\{enhanceSheetTabs\(\)\}/);
  assert.match(app, /function updateDiceUI\(roll\)\{\n try\{updateSheetVitalsBar\(\)\}/);
  for (const a of ['data-svb-step', 'data-svb-d20', 'data-svb-repeat', 'data-svb-last', "setAttribute('role','tablist')"]) {
    assert.ok(app.includes(a), a);
  }
});

test('ficha: a barra de vitais reaproveita o handler existente de vida/sanidade (sem duplicar regra)', () => {
  assert.match(app, /document\.querySelector\(`\[data-resource-input="\$\{type\}"\]`\)/);
  assert.match(app, /inp\.dispatchEvent\(new Event\('input',\{bubbles:true\}\)\)/);
});
