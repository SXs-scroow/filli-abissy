/**
 * Terreno-base a partir de um lugar REAL, com dados do OpenStreetMap.
 *
 * 1. Nominatim localiza o lugar digitado.
 * 2. Overpass devolve as ruas, a água e as construções da área ao redor.
 * 3. Tudo é projetado no quadro do mapa (viewBox 55 15 520 400) e vira o mesmo formato
 *    de `campaignMap` que o gerador fictício produz.
 *
 * Dados © colaboradores do OpenStreetMap (ODbL). Se o lugar não existir ou os serviços
 * estiverem indisponíveis, quem chama usa o gerador fictício.
 */
import { makeVoronoiRegions, pointString } from './mapGenerator.js';

export const VIEW = { x: 55, y: 15, w: 520, h: 400 };
export const ATTRIBUTION = '© colaboradores do OpenStreetMap';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const MAX_ROADS = 320;
const MAX_BLOCKS = 240;

export class MapSourceError extends Error {
  constructor(code, message) { super(message); this.name = 'MapSourceError'; this.code = code; }
}

async function fetchJson(fetchImpl, url, init = {}, timeoutMs = 30000) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, { ...init, signal: controller?.signal });
    if (!res.ok) throw new MapSourceError(`HTTP_${res.status}`, `o serviço respondeu ${res.status}`);
    return await res.json();
  } catch (error) {
    if (error instanceof MapSourceError) throw error;
    if (error?.name === 'AbortError') throw new MapSourceError('TIMEOUT', 'o serviço demorou demais para responder');
    throw new MapSourceError('NETWORK', String(error?.message || error));
  } finally { if (timer) clearTimeout(timer); }
}

export async function geocode(query, fetchImpl) {
  const text = String(query || '').trim().slice(0, 120);
  if (!text) throw new MapSourceError('NOT_FOUND', 'nenhum lugar informado');
  const rows = await fetchJson(fetchImpl, `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(text)}`, { headers: { Accept: 'application/json' } }, 15000);
  const row = Array.isArray(rows) ? rows[0] : null;
  const lat = Number(row?.lat), lon = Number(row?.lon);
  if (!row || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new MapSourceError('NOT_FOUND', 'lugar não encontrado no mapa real');
  const bb = Array.isArray(row.boundingbox) ? row.boundingbox.map(Number) : null; // [sul, norte, oeste, leste]
  return { lat, lon, name: String(row.display_name || text).slice(0, 160), boundingbox: bb && bb.length === 4 && bb.every(Number.isFinite) ? bb : null };
}

/** Janela geográfica com a mesma proporção do quadro (520x400), entre 1,1 e 3,2 km de largura. */
export function viewBounds(place, { minSpanM = 1100, maxSpanM = 3200, defaultSpanM = 2400 } = {}) {
  const perLat = 111320, perLon = 111320 * Math.max(0.2, Math.cos(place.lat * Math.PI / 180));
  let spanX = defaultSpanM;
  if (place.boundingbox) spanX = Math.max(minSpanM, Math.min(maxSpanM, Math.abs(place.boundingbox[3] - place.boundingbox[2]) * perLon * 1.08));
  const spanY = spanX / (VIEW.w / VIEW.h);
  const dLon = spanX / 2 / perLon, dLat = spanY / 2 / perLat;
  return { south: place.lat - dLat, north: place.lat + dLat, west: place.lon - dLon, east: place.lon + dLon };
}

export function overpassQuery(b, kind) {
  const bbox = [b.south, b.west, b.north, b.east].map((v) => v.toFixed(5)).join(',');
  if (kind === 'buildings') return `[out:json][timeout:25];way["building"](${bbox});out geom qt 1500;`;
  return `[out:json][timeout:25];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](${bbox});way["waterway"~"^(river|stream|canal)$"](${bbox});way["natural"~"^(water|coastline)$"](${bbox}););out geom qt 4000;`;
}

async function overpass(fetchImpl, query) {
  let last;
  for (const url of OVERPASS) {
    try {
      const data = await fetchJson(fetchImpl, url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` }, 30000);
      if (data?.remark && !(data.elements || []).length) throw new MapSourceError('OVERPASS_REMARK', String(data.remark).slice(0, 120));
      return Array.isArray(data?.elements) ? data.elements : [];
    } catch (error) { last = error; }
  }
  throw last || new MapSourceError('NETWORK', 'sem resposta dos serviços de mapa');
}

export function makeProjector(b) {
  return (lat, lon) => ({ x: VIEW.x + (lon - b.west) / (b.east - b.west) * VIEW.w, y: VIEW.y + (b.north - lat) / (b.north - b.south) * VIEW.h });
}

function simplify(points, tolerance) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const a = points[i], c = points[j];
    const dx = c.x - a.x, dy = c.y - a.y, len2 = dx * dx + dy * dy || 1e-9;
    let best = -1, bestD = tolerance;
    for (let k = i + 1; k < j; k++) {
      const t = Math.max(0, Math.min(1, ((points[k].x - a.x) * dx + (points[k].y - a.y) * dy) / len2));
      const d = Math.hypot(points[k].x - (a.x + t * dx), points[k].y - (a.y + t * dy));
      if (d > bestD) { bestD = d; best = k; }
    }
    if (best > 0) { keep[best] = 1; stack.push([i, best], [best, j]); }
  }
  return points.filter((_, k) => keep[k]);
}

/** Divide a linha em trechos dentro do quadro (com margem), mantendo o ponto vizinho de fora para a linha chegar até a borda. */
function clipRuns(points, margin = 60) {
  const inside = (p) => p.x >= VIEW.x - margin && p.x <= VIEW.x + VIEW.w + margin && p.y >= VIEW.y - margin && p.y <= VIEW.y + VIEW.h + margin;
  const runs = []; let run = [];
  points.forEach((p, i) => {
    if (inside(p)) {
      if (!run.length && i > 0) run.push(points[i - 1]);
      run.push(p);
    } else if (run.length) { run.push(p); runs.push(run); run = []; }
  });
  if (run.length) runs.push(run);
  return runs.filter((r) => r.length >= 2);
}

function bufferLine(points, width) {
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    left.push({ x: points[i].x - ty * width / 2, y: points[i].y + tx * width / 2 });
    right.push({ x: points[i].x + ty * width / 2, y: points[i].y - tx * width / 2 });
  }
  return left.concat(right.reverse());
}

/** No OSM a terra fica à ESQUERDA da linha da costa; a água é preenchida do lado direito. */
function seaPolygon(points, depth = 900) {
  const far = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    return { x: p.x - ty * depth, y: p.y + tx * depth };
  });
  return points.concat(far.reverse());
}

const ROAD_RANK = { motorway: 0, trunk: 0, primary: 1, secondary: 2, tertiary: 3, residential: 4, unclassified: 4, living_street: 4, pedestrian: 4 };
const WATERWAY_WIDTH = { river: 8, canal: 5, stream: 2.4 };
const num = (v) => (Math.round(v * 10) / 10);
const pathOf = (pts, close = false) => `M ${pts.map((p) => `${num(p.x)} ${num(p.y)}`).join(' L ')}${close ? ' Z' : ''}`;
const polyArea = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };
const geometryOf = (el, project) => (Array.isArray(el.geometry) ? el.geometry.filter((g) => Number.isFinite(g?.lat) && Number.isFinite(g?.lon)).map((g) => project(g.lat, g.lon)) : []);

export function buildCartography(elements, buildings, project, options = {}) {
  const roads = [], water = [];
  let coastal = false;
  for (const el of elements || []) {
    if (el?.type !== 'way') continue;
    const tags = el.tags || {};
    const pts = geometryOf(el, project);
    if (pts.length < 2) continue;
    if (tags.highway in ROAD_RANK) {
      const rank = ROAD_RANK[tags.highway];
      for (const run of clipRuns(pts)) {
        const s = simplify(run, 0.5);
        const len = s.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) : 0), 0);
        if (len > 3) roads.push({ rank, len, d: pathOf(s) });
      }
    } else if (tags.natural === 'coastline') {
      coastal = true;
      for (const run of clipRuns(pts, 200)) water.push(pathOf(seaPolygon(simplify(run, 0.8)), true));
    } else if (tags.natural === 'water') {
      const closed = pts.length > 3 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.5;
      if (closed) { const s = simplify(pts, 0.4); if (s.length >= 3 && polyArea(s) > 4) water.push(pathOf(s, true)); }
    } else if (tags.waterway in WATERWAY_WIDTH) {
      for (const run of clipRuns(pts)) { const s = simplify(run, 0.5); if (s.length >= 2) water.push(pathOf(bufferLine(s, WATERWAY_WIDTH[tags.waterway]), true)); }
    }
  }
  roads.sort((a, b) => a.rank - b.rank || b.len - a.len);

  const blockCandidates = [];
  for (const el of buildings || []) {
    if (el?.type !== 'way') continue;
    const pts = geometryOf(el, project);
    if (pts.length < 4) continue;
    const s = simplify(pts.slice(0, -1), 0.25).slice(0, 8);
    if (s.length < 3 || polyArea(s) < 1.2) continue;
    if (s.every((p) => p.x < VIEW.x || p.x > VIEW.x + VIEW.w || p.y < VIEW.y || p.y > VIEW.y + VIEW.h)) continue;
    blockCandidates.push(pointString(s));
  }
  const step = Math.max(1, blockCandidates.length / MAX_BLOCKS);
  const blocks = [];
  for (let i = 0; i < blockCandidates.length && blocks.length < MAX_BLOCKS; i += step) blocks.push(blockCandidates[Math.floor(i)]);

  return {
    roads: options.includeRoads ? roads.slice(0, MAX_ROADS).map((r) => r.d) : [],
    blocks: options.includeSquares ? blocks : [],
    waterPath: options.includeWater ? water.join(' ') : '',
    coastal,
    found: { roads: roads.length, water: water.length, buildings: blockCandidates.length },
  };
}

const COMPASS = { centro: [.5, .5], norte: [.5, .2], sul: [.5, .8], leste: [.8, .5], oeste: [.2, .5], extremo: [.86, .84] };
const toFrame = (fx, fy) => ({ x: VIEW.x + 8 + Math.min(.95, Math.max(.05, fx)) * (VIEW.w - 16), y: VIEW.y + 8 + Math.min(.95, Math.max(.05, fy)) * (VIEW.h - 16) });
const cellVertices = (r) => String(r.points || '').trim().split(/\s+/).length;
const cellArea = (r) => { const p = String(r.points).trim().split(/\s+/).map((t) => t.split(',').map(Number)); let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };

function ringSites(templates, count, attempt) {
  const used = [];
  return Array.from({ length: count }, (_, i) => {
    const key = String(templates[i]?.id || '').toLowerCase();
    const angle = i * Math.PI * 2 / count + attempt * 0.21;
    const radius = .30 + .04 * (attempt % 3);
    let [fx, fy] = COMPASS[key] || [.5 + radius * Math.cos(angle), .5 + radius * Math.sin(angle)];
    if (COMPASS[key] && attempt) { fx += Math.sin(attempt * 1.7 + i) * .03; fy += Math.cos(attempt * 1.3 + i) * .03; }
    while (used.some(([ux, uy]) => Math.hypot(ux - fx, uy - fy) < .06)) { fx += .05; fy += .04; }
    used.push([fx, fy]);
    return toFrame(fx, fy);
  });
}

/** Grade regular: o diagrama de Voronoi de pontos em grade só gera retângulos, sempre válidos. */
function gridSites(count) {
  const cols = Math.ceil(Math.sqrt(count * 1.3)), rows = Math.ceil(count / cols);
  return Array.from({ length: count }, (_, i) => toFrame(((i % cols) + .5) / cols, (Math.floor(i / cols) + .5) / rows));
}

export function placeDistricts(templates = []) {
  const count = Math.max(5, Math.min(12, templates.length || 6));
  const boundary = [{ x: VIEW.x + 7, y: VIEW.y + 7 }, { x: VIEW.x + VIEW.w - 7, y: VIEW.y + 7 }, { x: VIEW.x + VIEW.w - 7, y: VIEW.y + VIEW.h - 7 }, { x: VIEW.x + 7, y: VIEW.y + VIEW.h - 7 }];
  const valid = (regions) => regions.every((r) => cellVertices(r) >= 4 && cellArea(r) > 2200);
  for (let attempt = 0; attempt < 40; attempt++) {
    const regions = makeVoronoiRegions(boundary, ringSites(templates, count, attempt), templates);
    if (valid(regions)) return regions;
  }
  return makeVoronoiRegions(boundary, gridSites(count), templates);
}

/** Gera o terreno-base de um lugar real. Lança MapSourceError (NOT_FOUND, EMPTY, TIMEOUT, NETWORK, HTTP_xxx). */
export async function generateRealTownLayout(reference, templates = [], options = {}, { fetchImpl = globalThis.fetch?.bind(globalThis), onStage = () => {} } = {}) {
  if (typeof fetchImpl !== 'function') throw new MapSourceError('NETWORK', 'este navegador não consegue consultar o mapa real');
  onStage('Procurando o lugar no OpenStreetMap...');
  const place = await geocode(reference, fetchImpl);
  const bounds = viewBounds(place);
  const project = makeProjector(bounds);
  const wantsTerrain = options.includeRoads || options.includeWater;
  let elements = [], buildings = [];
  if (wantsTerrain) { onStage('Baixando ruas e água da região...'); elements = await overpass(fetchImpl, overpassQuery(bounds, 'terrain')); }
  if (options.includeSquares) { onStage('Baixando as construções...'); buildings = await overpass(fetchImpl, overpassQuery(bounds, 'buildings')); }
  const cartography = buildCartography(elements, buildings, project, options);
  if ((wantsTerrain || options.includeSquares) && !cartography.found.roads && !cartography.found.water && !cartography.found.buildings) {
    throw new MapSourceError('EMPTY', 'não há dados de mapa nessa área');
  }
  const regions = placeDistricts(templates);
  return {
    regions,
    cartography: {
      roads: cartography.roads, blocks: cartography.blocks, waterPath: cartography.waterPath, coastal: cartography.coastal,
      reference: String(reference).slice(0, 80), generatedAt: Date.now(), real: true, attribution: ATTRIBUTION, place: place.name,
    },
  };
}
