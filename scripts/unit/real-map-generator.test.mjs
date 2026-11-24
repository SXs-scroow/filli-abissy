import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { geocode, viewBounds, makeProjector, overpassQuery, buildCartography, placeDistricts, generateRealTownLayout, MapSourceError, VIEW } from '../../src/realMapGenerator.js';

const CENTER = { lat: -20.3856, lon: -43.5035 };
const place = { ...CENTER, name: 'Ouro Preto, Minas Gerais, Brasil', boundingbox: [-20.41, -20.36, -43.53, -43.47] };

/** Ponto a "dx" e "dy" metros do centro, no formato do Overpass. */
const at = (dx, dy) => ({ lat: CENTER.lat + dy / 111320, lon: CENTER.lon + dx / (111320 * Math.cos(CENTER.lat * Math.PI / 180)) });
const way = (id, tags, ...pts) => ({ type: 'way', id, tags, geometry: pts.map(([dx, dy]) => at(dx, dy)) });

const terrain = [
  way(1, { highway: 'residential' }, [-900, 0], [-300, 40], [300, -30], [900, 0]),
  way(2, { highway: 'primary' }, [0, -700], [20, 0], [-10, 700]),
  way(3, { highway: 'footway' }, [0, 0], [50, 50]),
  way(4, { waterway: 'river' }, [-1000, -300], [0, -250], [1000, -350]),
  way(5, { natural: 'water' }, [300, 300], [500, 300], [500, 450], [300, 450], [300, 300]),
  way(6, { highway: 'tertiary', name: '<script>alert(1)</script>' }, [-500, -500], [500, 500]),
];
const buildings = Array.from({ length: 400 }, (_, i) => way(100 + i, { building: 'yes' }, [i * 4 - 800, 100], [i * 4 - 790, 100], [i * 4 - 790, 110], [i * 4 - 800, 110], [i * 4 - 800, 100]));

function fakeFetch({ nominatim = [{ lat: String(CENTER.lat), lon: String(CENTER.lon), display_name: place.name, boundingbox: place.boundingbox.map(String) }], overpassByCall, status = {} } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.startsWith('https://nominatim')) {
      if (status.nominatim) return { ok: false, status: status.nominatim, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => nominatim };
    }
    const n = calls.filter((c) => !c.url.startsWith('https://nominatim')).length - 1;
    const body = decodeURIComponent(String(init.body || '').replace(/^data=/, ''));
    const handler = overpassByCall?.[n];
    if (handler instanceof Error) throw handler;
    if (typeof handler === 'number') return { ok: false, status: handler, json: async () => ({}) };
    const elements = handler ?? (body.includes('"building"') ? buildings : terrain);
    return { ok: true, status: 200, json: async () => ({ elements }) };
  };
  fn.calls = calls;
  return fn;
}

test('a janela geográfica tem a proporção do quadro e fica entre 1,1 e 3,2 km', () => {
  const b = viewBounds(place);
  const wm = (b.east - b.west) * 111320 * Math.cos(CENTER.lat * Math.PI / 180);
  const hm = (b.north - b.south) * 111320;
  assert.ok(wm >= 1100 && wm <= 3200, String(wm));
  assert.ok(Math.abs(wm / hm - VIEW.w / VIEW.h) < 0.01);
  const small = viewBounds({ ...CENTER, boundingbox: [-20.386, -20.385, -43.504, -43.503] });
  assert.ok((small.east - small.west) * 111320 * Math.cos(CENTER.lat * Math.PI / 180) >= 1099);
});

test('a projeção põe o centro no meio do quadro e as bordas nos cantos', () => {
  const b = viewBounds(place), project = makeProjector(b);
  const c = project(CENTER.lat, CENTER.lon);
  assert.ok(Math.abs(c.x - (VIEW.x + VIEW.w / 2)) < 0.5 && Math.abs(c.y - (VIEW.y + VIEW.h / 2)) < 0.5);
  const nw = project(b.north, b.west), se = project(b.south, b.east);
  assert.deepEqual([Math.round(nw.x), Math.round(nw.y), Math.round(se.x), Math.round(se.y)], [VIEW.x, VIEW.y, VIEW.x + VIEW.w, VIEW.y + VIEW.h]);
});

test('gera o terreno a partir de dados reais: ruas ordenadas, água, quadras e crédito', async () => {
  const f = fakeFetch();
  const stages = [];
  const g = await generateRealTownLayout('Ouro Preto, Brasil', [], { includeRoads: true, includeWater: true, includeSquares: true }, { fetchImpl: f, onStage: (m) => stages.push(m) });
  assert.equal(g.cartography.real, true);
  assert.match(g.cartography.attribution, /OpenStreetMap/);
  assert.match(g.cartography.place, /Ouro Preto/);
  assert.equal(g.cartography.roads.length, 3, 'footway ignorado; residential, primary e tertiary entram');
  assert.ok(g.cartography.roads[0].startsWith('M '));
  assert.ok(/ Z/.test(g.cartography.waterPath), 'água vira polígono fechado');
  assert.ok((g.cartography.waterPath.match(/M /g) || []).length >= 2, 'rio e lago');
  assert.ok(g.cartography.blocks.length > 0 && g.cartography.blocks.length <= 240);
  assert.ok(g.regions.length >= 5 && g.regions.every((r) => r.points.split(' ').length >= 4));
  assert.ok(stages.length >= 3);
  assert.equal(f.calls.filter((c) => c.url.startsWith('https://nominatim')).length, 1);
  assert.equal(f.calls.filter((c) => c.url.startsWith('https://overpass-api.de')).length, 2);
  assert.equal(f.calls.find((c) => c.url.includes('overpass')).init.method, 'POST');
});

test('a via principal vem primeiro e o texto das ruas nunca chega ao desenho', () => {
  const project = makeProjector(viewBounds(place));
  const c = buildCartography(terrain, [], project, { includeRoads: true, includeWater: true, includeSquares: false });
  assert.match(c.roads[0], /^M /);
  assert.ok(!JSON.stringify(c).includes('script'));
  assert.ok(/^[\dM L.\-Z]+$/.test(c.roads.join(' ')), 'só números e comandos de caminho');
  assert.equal(c.blocks.length, 0);
});

test('só consulta o que foi marcado', async () => {
  const f = fakeFetch();
  await generateRealTownLayout('Ouro Preto', [], { includeRoads: true }, { fetchImpl: f });
  assert.equal(f.calls.filter((c) => c.url.includes('overpass')).length, 1);
  const g = await generateRealTownLayout('Ouro Preto', [], {}, { fetchImpl: fakeFetch() });
  assert.equal(g.cartography.roads.length + g.cartography.blocks.length, 0);
  assert.equal(g.cartography.waterPath, '');
});

test('os distritos seguem os pontos cardeais dos nomes do Mestre', () => {
  const t = [{ id: 'centro', name: 'C' }, { id: 'norte', name: 'N' }, { id: 'leste', name: 'L' }, { id: 'sul', name: 'S' }, { id: 'oeste', name: 'O' }, { id: 'extremo', name: 'E' }];
  const regions = placeDistricts(t);
  const centroid = (r) => { const p = r.points.split(' ').map((s) => s.split(',').map(Number)); return { x: p.reduce((a, q) => a + q[0], 0) / p.length, y: p.reduce((a, q) => a + q[1], 0) / p.length }; };
  const by = Object.fromEntries(regions.map((r) => [r.name, centroid(r)]));
  assert.ok(by.N.y < by.C.y && by.C.y < by.S.y, 'norte acima do centro, sul abaixo');
  assert.ok(by.O.x < by.C.x && by.C.x < by.L.x, 'oeste à esquerda, leste à direita');
});

test('lugar inexistente é NOT_FOUND e área vazia é EMPTY', async () => {
  await assert.rejects(generateRealTownLayout('Vales de Cinza', [], { includeRoads: true }, { fetchImpl: fakeFetch({ nominatim: [] }) }), (e) => e instanceof MapSourceError && e.code === 'NOT_FOUND');
  await assert.rejects(generateRealTownLayout('Oceano', [], { includeRoads: true }, { fetchImpl: fakeFetch({ overpassByCall: [[]] }) }), (e) => e.code === 'EMPTY');
  await assert.rejects(geocode('   ', fakeFetch()), (e) => e.code === 'NOT_FOUND');
});

test('falhas dos serviços viram erros claros, e o segundo servidor do Overpass é tentado', async () => {
  await assert.rejects(generateRealTownLayout('X', [], { includeRoads: true }, { fetchImpl: fakeFetch({ status: { nominatim: 429 } }) }), (e) => e.code === 'HTTP_429');
  const abort = Object.assign(new Error('abortado'), { name: 'AbortError' });
  await assert.rejects(generateRealTownLayout('X', [], { includeRoads: true }, { fetchImpl: fakeFetch({ overpassByCall: [abort, abort] }) }), (e) => e.code === 'TIMEOUT');
  const f = fakeFetch({ overpassByCall: [504] });
  const g = await generateRealTownLayout('X', [], { includeRoads: true }, { fetchImpl: f });
  assert.equal(g.cartography.real, true);
  assert.equal(f.calls.filter((c) => c.url.includes('overpass')).length, 2);
  assert.ok(f.calls.at(-1).url.startsWith('https://overpass.kumi.systems'));
  await assert.rejects(generateRealTownLayout('X', [], {}, { fetchImpl: null }), (e) => e.code === 'NETWORK');
});

test('a consulta do Overpass pede só o necessário e a tela mostra o crédito e o botão correto', () => {
  const q = overpassQuery(viewBounds(place), 'terrain');
  assert.match(q, /\[timeout:25\]/); assert.match(q, /out geom qt 4000/);
  assert.match(overpassQuery(viewBounds(place), 'buildings'), /"building"/);
  const map = readFileSync(new URL('../../src/campaignMap.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(map, /generateRealTownLayout\(reference,regions,options/);
  assert.match(map, /id="mapUseReal" type="checkbox" checked/);
  assert.match(map, /cartography\.attribution/);
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /connect-src[^;]*https:\/\/nominatim\.openstreetmap\.org/);
  assert.match(csp, /connect-src[^;]*https:\/\/overpass-api\.de/);
});

test('todo distrito tem ao menos 4 vértices e área útil, com qualquer quantidade de nomes', () => {
  const area = (r) => { const p = r.points.split(' ').map((s) => s.split(',').map(Number)); let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };
  for (const n of [0, 3, 5, 6, 7, 8, 9, 10, 11, 12, 20]) {
    const templates = Array.from({ length: n }, (_, i) => ({ id: `d${i}`, name: `D${i}` }));
    const regions = placeDistricts(templates);
    assert.ok(regions.length >= 5 && regions.length <= 12, `n=${n}`);
    for (const r of regions) assert.ok(r.points.split(' ').length >= 4 && area(r) > 2200, `n=${n} ${r.name}`);
  }
});
