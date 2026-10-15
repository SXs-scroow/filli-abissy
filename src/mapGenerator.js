/** Gerador cartográfico procedural: bairros contíguos, eixos viários, ruas secundárias e quadras. */
function seededRandom(text) {
  let seed = 2166136261;
  for (const ch of String(text || 'Ashen').toLowerCase()) { seed ^= ch.charCodeAt(0); seed = Math.imul(seed, 16777619); }
  return () => { seed += 0x6D2B79F5; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pointString = points => points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
function polygonPoint(cx, cy, rx, ry, angle, rand, noise = .14) {
  const radius = 1 + (rand() - .5) * noise * 2;
  return { x: clamp(cx + Math.cos(angle) * rx * radius, 70, 555), y: clamp(cy + Math.sin(angle) * ry * radius, 24, 405) };
}
export function generateTownLayout(reference, templates = []) {
  const rand = seededRandom(reference);
  const coastal = /port|costa|litoral|ba[ií]a|ilha|pen[ií]nsula|rio|lake|lago|mar|coast|harbor/i.test(reference);
  const cx = 310, cy = 215, rx = coastal ? 222 : 232, ry = 174;
  const n = Math.max(5, templates.length || 6);
  const outer = Array.from({ length: 48 }, (_, i) => polygonPoint(cx, cy, rx, ry, (Math.PI * 2 * i) / 48, rand, .18));
  // Partição radial: todos os distritos compartilham um centro e arestas vizinhas.
  const regions = Array.from({ length: n }, (_, i) => {
    const wedge = [{ x: cx, y: cy }];
    const steps = outer.length / n;
    for (let j = 0; j <= steps; j++) {
      const index = Math.round((i * steps + j) % outer.length);
      wedge.push(outer[index]);
    }
    const t = templates[i] || { id: `district-${i + 1}`, name: `Distrito ${i + 1}`, color: ['#8e7350','#536c4b','#6b6870','#78644e','#456c78','#59654a'][i % 6], description: '' };
    return { ...t, points: pointString(wedge) };
  });
  // A avenida principal cruza o centro; anéis e ramais conectam os bairros como malha urbana.
  const roads = [];
  const mainAngle = (rand() * .8) - .4;
  roads.push(`M ${Math.round(cx - 220)} ${Math.round(cy + 100)} C ${Math.round(cx - 80)} ${Math.round(cy + 45)}, ${Math.round(cx + 35)} ${Math.round(cy - 52)}, ${Math.round(cx + 220)} ${Math.round(cy - 130)}`);
  roads.push(`M ${Math.round(cx - 24)} 28 C ${Math.round(cx + 30)} 142, ${Math.round(cx - 40)} 280, ${Math.round(cx + 26)} 405`);
  roads.push(`M 124 ${Math.round(cy - 10)} C 215 ${Math.round(cy - 62)}, 356 ${Math.round(cy + 100)}, 500 ${Math.round(cy + 8)}`);
  for (const radius of [62, 104, 148]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; const r = radius * (1 + (rand() - .5) * .12); pts.push({ x: clamp(cx + Math.cos(a) * r * 1.18, 72, 552), y: clamp(cy + Math.sin(a) * r * .84, 24, 405) }); }
    roads.push(`M ${pts.map(p => `${Math.round(p.x)} ${Math.round(p.y)}`).join(' L ')}`);
  }
  // Quadras retangulares imperfeitas orientadas numa malha leve, evitando as bordas.
  const blocks = [];
  for (let y = 45; y < 400; y += 22 + rand() * 10) {
    for (let x = 82; x < 548; x += 23 + rand() * 11) {
      const dx = x - cx, dy = y - cy;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > .88 || rand() < .32) continue;
      const w = 7 + rand() * 12, h = 5 + rand() * 10, skew = (rand() - .5) * 5;
      blocks.push(pointString([{x:x+skew,y},{x:x+w,y:y+skew},{x:x+w-skew,y:y+h},{x,y:y+h-skew}]));
    }
  }
  const waterPath = coastal ? `M 550 20 C 505 92, 565 140, 530 210 S 566 320, 535 405 L 585 405 L 585 20 Z` : '';
  return { regions, cartography: { roads, blocks, waterPath, coastal, reference: String(reference || '').slice(0, 80), generatedAt: Date.now() } };
}
