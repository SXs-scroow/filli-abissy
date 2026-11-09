import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const IDS = ['miasma', 'chamas-do-caos', 'decadencia', 'ciclo-da-existencia'];

function loadSpells() {
  const start = app.indexOf('const INITIAL_SPELLS=[');
  const end = app.indexOf('];', start) + 2;
  return new Function(`${app.slice(start, end)}; return INITIAL_SPELLS;`)();
}

test('magias novas existem, com texto transcrito e símbolo como imagem', () => {
  const spells = loadSpells();
  for (const id of IDS) {
    const sp = spells.find(x => x.id === id);
    assert.ok(sp, `magia ${id} ausente`);
    assert.ok(sp.description.length > 80);
    assert.match(sp.image, /^\/spells\/[a-z-]+\.webp$/);
    assert.ok(fs.existsSync(new URL(`../../public${sp.image}`, import.meta.url)), `imagem ${sp.image} ausente`);
  }
  assert.equal(new Set(spells.map(x => x.id)).size, spells.length, 'ids de magia duplicados');
  assert.match(spells.find(x => x.id === 'miasma').description, /5d6 pontos de dano de veneno/);
  assert.match(spells.find(x => x.id === 'decadencia').description, /2d8\+2 pontos de dano de Morte/);
  assert.match(spells.find(x => x.id === 'ciclo-da-existencia').description, /3d6 pontos de dano de morte/);
  assert.match(spells.find(x => x.id === 'chamas-do-caos').description, /Requer 3º círculo/);
});

test('campanhas já salvas recebem as magias novas uma única vez (apagar depois continua valendo)', () => {
  assert.match(app, /const SEEDED_SPELL_IDS=\['miasma','chamas-do-caos','decadencia','ciclo-da-existencia'\]/);
  const line = app.split('\n').find(l => l.includes('SEEDED_SPELL_IDS.forEach'));
  assert.ok(line);
  const spells = loadSpells();
  const run = state => {
    new Function('state', 'INITIAL_SPELLS', 'SEEDED_SPELL_IDS', 'clone', line)(state, spells, IDS, o => JSON.parse(JSON.stringify(o)));
    return state;
  };
  const saved = run({ spells: [{ id: 'worm-rot' }], seededSpellIds: [] });
  assert.deepEqual(saved.spells.map(x => x.id), ['worm-rot', ...IDS]);
  saved.spells = saved.spells.filter(x => x.id !== 'miasma');
  run(saved);
  assert.ok(!saved.spells.some(x => x.id === 'miasma'), 'magia apagada não pode voltar');
});
