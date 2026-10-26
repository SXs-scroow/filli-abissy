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
