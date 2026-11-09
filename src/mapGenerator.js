/**
 * Gerador cartográfico procedural de Vales de Cinza.
 * Saída compatível com campaignMap: polígonos de regiões, vias, quadras e água.
 * A semente torna o desenho repetível para a mesma referência.
 */
function seededRandom(text) {
  let seed = 2166136261;
  for (const ch of String(text || 'Ashen').toLowerCase()) {
    seed ^= ch.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pointString = points => points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const crosses = ((a.y > point.y) !== (b.y > point.y)) && (point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-9) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

function clipHalfPlane(polygon, a, b, c) {
  if (!polygon.length) return [];
  const out = [];
  let previous = polygon[polygon.length - 1];
  let previousInside = a * previous.x + b * previous.y <= c + 1e-7;
  for (const current of polygon) {
    const currentInside = a * current.x + b * current.y <= c + 1e-7;
    if (currentInside !== previousInside) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const denominator = a * dx + b * dy;
      if (Math.abs(denominator) > 1e-8) {
        const t = (c - a * previous.x - b * previous.y) / denominator;
        out.push({ x: previous.x + t * dx, y: previous.y + t * dy });
      }
    }
    if (currentInside) out.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return out;
}

function makeBoundary(rand, coastal) {
  const cx = coastal ? 300 : 310;
  const cy = 215;
  const rx = coastal ? 210 : 232;
  const ry = 174;
  return Array.from({ length: 56 }, (_, i) => {
    const angle = Math.PI * 2 * i / 56;
    const roughness = 1 + (rand() - .5) * .13;
    const x = cx + Math.cos(angle) * rx * roughness;
    const y = cy + Math.sin(angle) * ry * roughness;
    return { x: clamp(x, 68, 555), y: clamp(y, 24, 405) };
  });
}

function segDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-9;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function polylineDistance(p, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, segDistance(p, pts[i - 1], pts[i]));
  return best;
}

function makeWater(rand, coastal) {
  if (coastal) {
    const phase = rand() * 6.28, base = 486 + (rand() - .5) * 14;
    const edge = y => base + Math.sin(y * .032 + phase) * 15 + Math.sin(y * .011 + phase * 2) * 9;
    const pts = Array.from({ length: 33 }, (_, i) => ({ y: 18 + i * 12.2 })).map(p => ({ x: edge(p.y) + (rand() - .5) * 4, y: p.y }));
    const path = `M ${pts.map(p => `${Math.round(p.x)} ${Math.round(p.y)}`).join(' L ')} L 585 405 L 585 18 Z`;
    return { path, blocks: (p, pad = 0) => p.x > edge(p.y) - 4 - pad, clipX: y => edge(y) - 4 };
  }
  const cx = 310, cy = 215, theta = rand() * Math.PI, phase = rand() * 6.28, amp = 20 + rand() * 12;
  const dir = { x: Math.cos(theta), y: Math.sin(theta) }, nrm = { x: -dir.y, y: dir.x };
  const shift = (rand() - .5) * 90;
  const N = 44;
  const center = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, along = (t - .5) * 640;
    const off = shift + Math.sin(t * Math.PI * 3 + phase) * amp;
    const p = { x: cx + dir.x * along + nrm.x * off, y: cy + dir.y * along + nrm.y * off, w: 8 + t * 9 };
    if (((p.x - cx) / 262) ** 2 + ((p.y - cy) / 200) ** 2 < 1) center.push(p);
  }
  if (center.length < 4) return { path: '', blocks: () => false, clipX: null };
  const left = [], right = [];
  center.forEach((p, i) => {
    const q = center[Math.min(i + 1, center.length - 1)], o = center[Math.max(i - 1, 0)];
    let tx = q.x - o.x, ty = q.y - o.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    left.push({ x: p.x - ty * p.w / 2, y: p.y + tx * p.w / 2 });
    right.push({ x: p.x + ty * p.w / 2, y: p.y - tx * p.w / 2 });
  });
  const path = `M ${left.concat(right.reverse()).map(p => `${Math.round(p.x)} ${Math.round(p.y)}`).join(' L ')} Z`;
  const wMax = center[center.length - 1].w;
  return {
    path,
    blocks: (p, pad = 0) => {
      return polylineDistance(p, center) < wMax / 2 + 3 + pad;
    },
    clipX: null
  };
}

function makeDistrictSites(rand, count, water, boundary) {
  const sites = [];
  const cx = 310, cy = 215;
  for (let i = 0; i < count; i++) {
    let site;
    for (let attempt = 0; attempt < 140; attempt++) {
      const x = 95 + rand() * 430;
      const y = 52 + rand() * 326;
      const normalized = ((x - cx) / 225) ** 2 + ((y - cy) / 165) ** 2;
      if (normalized < .91 && pointInPolygon({ x, y }, boundary) && !water.blocks({ x, y }, 16) && sites.every(other => distance2(other, { x, y }) > 48 ** 2)) {
        site = { x, y };
        break;
      }
    }
    sites.push(site || { x: cx + Math.cos(i * Math.PI * 2 / count) * 110, y: cy + Math.sin(i * Math.PI * 2 / count) * 82 });
  }
  return sites;
}

function makeVoronoiRegions(boundary, sites, templates) {
  return sites.map((site, i) => {
    let cell = boundary.slice();
    for (let j = 0; j < sites.length && cell.length; j++) {
      if (i === j) continue;
      const other = sites[j];
      const a = 2 * (other.x - site.x);
      const b = 2 * (other.y - site.y);
      const c = other.x ** 2 + other.y ** 2 - site.x ** 2 - site.y ** 2;
      cell = clipHalfPlane(cell, a, b, c);
    }
    const template = templates[i] || {
      id: `district-${i + 1}`, name: `Distrito ${i + 1}`,
      color: ['#8e7350', '#536c4b', '#6b6870', '#78644e', '#456c78', '#59654a'][i % 6], description: ''
    };
    return { ...template, points: pointString(cell) };
  });
}

const quad = (a, c, b, t) => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y
});

function makeRoadNetwork(rand, sites, boundary) {
  const cx = 310, cy = 215, n = sites.length;
  const edges = [], linked = new Set();
  const key = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);
  const inTree = new Set([0]);
  while (inTree.size < n) {
    let best = null;
    for (const i of inTree) for (let j = 0; j < n; j++) {
      if (inTree.has(j)) continue;
      const d = distance2(sites[i], sites[j]);
      if (!best || d < best.d) best = { i, j, d };
    }
    inTree.add(best.j); edges.push([best.i, best.j]); linked.add(key(best.i, best.j));
  }
  for (let i = 0; i < n; i++) {
    let near = -1, nd = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i || linked.has(key(i, j))) continue;
      const d = distance2(sites[i], sites[j]);
      if (d < nd) { nd = d; near = j; }
    }
    if (near >= 0 && rand() < .55) { edges.push([i, near]); linked.add(key(i, near)); }
  }
  const hub = sites.reduce((best, s, i) => (distance2(s, { x: cx, y: cy }) < distance2(sites[best], { x: cx, y: cy }) ? i : best), 0);
  edges.sort((e1, e2) => (e2.includes(hub) ? 1 : 0) - (e1.includes(hub) ? 1 : 0));
  const segments = edges.map(([i, j]) => ({ a: sites[i], b: sites[j] }));
  sites.map((s, i) => ({ s, d: distance2(s, { x: cx, y: cy }) })).sort((p, q) => q.d - p.d).slice(0, 3).forEach(({ s }) => {
    const l = Math.hypot(s.x - cx, s.y - cy) || 1, ux = (s.x - cx) / l, uy = (s.y - cy) / l;
    let end = null;
    for (let step = 6; step < 320; step += 4) {
      const p = { x: s.x + ux * step, y: s.y + uy * step };
      if (!pointInPolygon(p, boundary)) break;
      end = p;
    }
    if (end && Math.hypot(end.x - s.x, end.y - s.y) > 14) segments.push({ a: s, b: end });
  });
  return segments.map(({ a, b }) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const bend = (rand() - .5) * len * .2;
    const c = { x: (a.x + b.x) / 2 - (b.y - a.y) / len * bend, y: (a.y + b.y) / 2 + (b.x - a.x) / len * bend };
    const samples = Array.from({ length: 16 }, (_, k) => quad(a, c, b, k / 15));
    return { d: `M ${Math.round(a.x)} ${Math.round(a.y)} Q ${Math.round(c.x)} ${Math.round(c.y)} ${Math.round(b.x)} ${Math.round(b.y)}`, samples };
  });
}

function makeBlocks(rand, roads, boundary, water, sites) {
  const all = roads.flatMap(r => r.samples);
  const candidates = [];
  for (const road of roads) {
    const pts = road.samples;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const tx = (b.x - a.x) / len, ty = (b.y - a.y) / len, angle = Math.atan2(ty, tx);
      for (let off = 0; off < len; off += 13 + rand() * 6) {
        for (const side of [-1, 1]) {
          const dist = 11 + rand() * 6;
          const p = { x: a.x + tx * off - ty * dist * side, y: a.y + ty * off + tx * dist * side };
          candidates.push({ p, angle, size: 5 + rand() * 6, near: Math.min(...sites.map(s => Math.hypot(s.x - p.x, s.y - p.y))) });
        }
      }
    }
  }
  candidates.sort((u, v) => u.near - v.near);
  const placed = [];
  for (const c of candidates) {
    if (placed.length >= 240) break;
    if (!pointInPolygon(c.p, boundary) || water.blocks(c.p, 4)) continue;
    if (all.some(q => Math.hypot(q.x - c.p.x, q.y - c.p.y) < 8)) continue;
    if (placed.some(o => Math.hypot(o.p.x - c.p.x, o.p.y - c.p.y) < 12)) continue;
    placed.push(c);
  }
  return placed.map(({ p, angle, size }) => {
    const h = size / 2, cos = Math.cos(angle), sin = Math.sin(angle);
    return pointString([[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => ({ x: p.x + x * cos - y * sin, y: p.y + x * sin + y * cos })));
  });
}

export function generateTownLayout(reference, templates = [], options = {}) {
  const source = String(reference || 'Ashen').slice(0, 80);
  const rand = seededRandom(source);
  const coastal = /port|costa|litoral|ba[ií]a|ilha|pen[ií]nsula|rio|lake|lago|mar|coast|harbor/i.test(source);
  const count = Math.max(5, Math.min(12, templates.length || 6));
  const water = makeWater(rand, coastal);
  let boundary = makeBoundary(rand, coastal);
  if (water.clipX) boundary = boundary.map(p => ({ x: Math.min(p.x, water.clipX(p.y)), y: p.y }));
  const cellArea = r => {
    const pts = r.points.split(' ').map(t => t.split(',').map(Number));
    let a = 0;
    for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; }
    return Math.abs(a) / 2;
  };
  let sites, regions;
  for (let attempt = 0; attempt < 24; attempt++) {
    sites = makeDistrictSites(rand, count, water, boundary);
    const mid = sites.reduce((best, site, i) => (distance2(site, { x: 310, y: 215 }) < distance2(sites[best], { x: 310, y: 215 }) ? i : best), 0);
    [sites[0], sites[mid]] = [sites[mid], sites[0]];
    regions = makeVoronoiRegions(boundary, sites, templates);
    if (regions.every(r => r.points.split(' ').length >= 4 && cellArea(r) > 2200)) break;
  }
  const roadNetwork = makeRoadNetwork(rand, sites, boundary);
  const blockPolys = makeBlocks(rand, roadNetwork, boundary, water, sites);
  return {
    regions,
    cartography: {
      roads: options.includeRoads ? roadNetwork.map(r => r.d) : [],
      blocks: options.includeSquares ? blockPolys : [],
      waterPath: options.includeWater ? water.path : '',
      coastal,
      reference: source,
      generatedAt: Date.now()
    }
  };
}
