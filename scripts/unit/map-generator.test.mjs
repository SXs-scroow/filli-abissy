import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTownLayout } from '../../src/mapGenerator.js';

test('gerador cria apenas o terreno-base por padrão, sem rios, estradas ou casas automáticas', () => {
  const result = generateTownLayout('Empig Port', Array.from({length:6}, (_,i)=>({id:`r${i}`,name:`Região ${i}`,color:'#8e7350'})));
  assert.equal(result.regions.length, 6);
  assert.deepEqual(result.cartography.roads, []);
  assert.deepEqual(result.cartography.blocks, []);
  assert.equal(result.cartography.waterPath, '');
  assert.equal(result.cartography.coastal, true);
  assert.ok(result.regions.every(r => r.points.split(' ').length >= 4));
});

test('caminhos, água e quadradinhos só são gerados quando explicitamente pedidos', () => {
  const result = generateTownLayout('vale industrial', [], {includeRoads:true,includeWater:true,includeSquares:true});
  assert.ok(result.cartography.roads.length >= 5);
  assert.ok(result.cartography.blocks.length > 20);
  assert.ok(result.cartography.waterPath.length > 0);
});

test('mesma referência produz a mesma planta-base', () => {
  const templates = [{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}];
  const a = generateTownLayout('cidade montanhosa', templates);
  const b = generateTownLayout('cidade montanhosa', templates);
  assert.deepEqual(a.regions.map(r=>r.points), b.regions.map(r=>r.points));
  assert.deepEqual(a.cartography.roads, b.cartography.roads);
});

function parsePath(d) {
  const nums = String(d).match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}
function inside(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / ((b.y - a.y) || 1e-9) + a.x) c = !c;
  }
  return c;
}

test('mapa coerente: casas nunca ficam na água e as vias ligam todos os distritos', () => {
  for (const ref of ['vale industrial', 'Empig Port', 'cidade montanhosa', 'Ashen Valley', 'lago negro', 'Cinzas']) {
    const r = generateTownLayout(ref, [], { includeRoads: true, includeWater: true, includeSquares: true });
    const water = parsePath(r.cartography.waterPath);
    assert.ok(water.length > 6, `${ref}: água gerada`);
    for (const b of r.cartography.blocks) {
      const pts = parsePath(b), c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
      assert.equal(inside(c, water), false, `${ref}: casa dentro da água em ${c.x},${c.y}`);
    }
    assert.ok(r.cartography.roads.length >= r.regions.length - 1, `${ref}: vias conectam os distritos`);
    assert.ok(r.cartography.blocks.length >= 20 && r.cartography.blocks.length <= 240, `${ref}: quantidade de casas`);
  }
});

test('ligar ou desligar água/vias não muda o formato dos distritos', () => {
  const a = generateTownLayout('vale industrial', [], {});
  const b = generateTownLayout('vale industrial', [], { includeRoads: true, includeWater: true, includeSquares: true });
  assert.deepEqual(a.regions.map(r => r.points), b.regions.map(r => r.points));
});

test('o primeiro distrito (Centro) fica no ponto mais central do mapa', () => {
  for (const ref of ['vale industrial', 'Empig Port', 'cidade montanhosa', 'Ashen Valley', 'lago negro']) {
    const r = generateTownLayout(ref, Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, name: `R${i}` })), {});
    const centroid = pts => { const p = parsePath(pts.replace(/,/g, ' ')); return { x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length }; };
    const d = pts => { const c = centroid(pts); return Math.hypot(c.x - 310, c.y - 215); };
    const dists = r.regions.map(x => d(x.points));
    assert.ok(dists[0] <= Math.min(...dists) + 45, `${ref}: distrito 0 deveria ser dos mais centrais`);
  }
});
