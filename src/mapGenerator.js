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

// Recorta um polígono por um semiplano a*x + b*y <= c (Sutherland–Hodgman).
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
    let x = cx + Math.cos(angle) * rx * roughness;
    let y = cy + Math.sin(angle) * ry * roughness;
    if (coastal && x > 475) x -= 14 + rand() * 15;
    return { x: clamp(x, 68, 555), y: clamp(y, 24, 405) };
  });
}

function makeDistrictSites(rand, count, boundary) {
  const sites = [];
  const cx = 310, cy = 215;
  for (let i = 0; i < count; i++) {
    let site;
    // Distribui centros pela área útil, evitando uma divisão em fatias que convergem num só ponto.
    for (let attempt = 0; attempt < 80; attempt++) {
      const x = 95 + rand() * 430;
      const y = 52 + rand() * 326;
      const normalized = ((x - cx) / 225) ** 2 + ((y - cy) / 165) ** 2;
      if (normalized < .91 && sites.every(other => distance2(other, { x, y }) > 43 ** 2)) {
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
      // |x-site|² <= |x-other|²
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

function makeRoads(rand) {
  const roads = [];
  const bends = Array.from({ length: 7 }, (_, i) => ({
    x: 78 + i * 75 + (rand() - .5) * 24,
    y: 74 + rand() * 278
  }));
  roads.push(`M ${bends.map(p => `${Math.round(p.x)} ${Math.round(p.y)}`).join(' Q ')}`);
  roads.push(`M 92 ${Math.round(90 + rand() * 45)} C 195 ${Math.round(150 + rand() * 40)}, 350 ${Math.round(90 + rand() * 65)}, 535 ${Math.round(300 + rand() * 35)}`);
  roads.push(`M ${Math.round(170 + rand() * 35)} 34 C ${Math.round(245 + rand() * 35)} 130, ${Math.round(265 + rand() * 35)} 260, ${Math.round(380 + rand() * 30)} 397`);
  // Duas vias curvas menores para ligar os centros dos distritos.
  roads.push(`M 110 300 Q 220 ${Math.round(230 + rand() * 30)} 320 280 T 510 220`);
  roads.push(`M 160 75 Q ${Math.round(240 + rand() * 20)} 145 260 205 T 430 345`);
  // Anel viário irregular, composto por segmentos em vez de uma elipse perfeita.
  for (const radius of [72, 132]) {
    const pts = Array.from({ length: 17 }, (_, i) => {
      const a = Math.PI * 2 * i / 16;
      const r = radius * (1 + (rand() - .5) * .16);
      return { x: clamp(310 + Math.cos(a) * r * 1.12, 76, 550), y: clamp(215 + Math.sin(a) * r * .82, 28, 402) };
    });
    roads.push(`M ${pts.map(p => `${Math.round(p.x)} ${Math.round(p.y)}`).join(' L ')}`);
  }
  return roads;
}

function makeBlocks(rand, boundary) {
  const blocks = [];
  for (let y = 42; y < 390; y += 17 + rand() * 10) {
    for (let x = 76; x < 550; x += 19 + rand() * 10) {
      const p = { x, y };
      if (pointInPolygon(p, boundary) && rand() > .27) {
        const w = 5 + rand() * 9;
        const h = w;
        const skew = (rand() - .5) * 4;
        blocks.push(pointString([
          { x: x + skew, y }, { x: x + w, y: y + skew },
          { x: x + w - skew, y: y + h }, { x, y: y + h - skew }
        ]));
      }
    }
  }
  return blocks;
}

export function generateTownLayout(reference, templates = [], options = {}) {
  const source = String(reference || 'Ashen').slice(0, 80);
  const rand = seededRandom(source);
  const coastal = /port|costa|litoral|ba[ií]a|ilha|pen[ií]nsula|rio|lake|lago|mar|coast|harbor/i.test(source);
  const count = Math.max(5, Math.min(12, templates.length || 6));
  const boundary = makeBoundary(rand, coastal);
  const sites = makeDistrictSites(rand, count, boundary);
  const regions = makeVoronoiRegions(boundary, sites, templates);
  const roads = options.includeRoads ? makeRoads(rand) : [];
  const blocks = options.includeSquares ? makeBlocks(rand, boundary).map(points => points) : [];
  const waterPath = options.includeWater
    ? (coastal ? 'M 535 18 C 496 75 550 117 518 171 S 553 276 521 335 L 575 405 L 585 405 L 585 18 Z' : 'M 75 32 C 142 80 112 120 175 164 S 250 235 205 280 S 235 345 300 410 L 276 420 C 214 360 185 320 163 285 S 220 225 152 175 S 120 95 55 56 Z')
    : '';
  return {
    regions,
    cartography: {
      roads, blocks, waterPath, coastal,
      reference: source,
      generatedAt: Date.now()
    }
  };
}
