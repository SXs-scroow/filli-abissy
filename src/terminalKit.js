// Ashen Testimony V1.5.34 — kit do terminal imersivo.
// Reúne: motor de áudio (Web Audio), boot sincronizado, navegação de pastas estilo eDEX-UI,
// arquivos corrompidos e player de gravações. Sem dependências: pode ser testado em Node.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/* ───────────────────────── Corrupção de arquivos ───────────────────────── */

export const CORRUPTION_LEVELS = [
  ['partial', 'Leve — quase legível'],
  ['severe', 'Grave — só fragmentos'],
  ['total', 'Total — ilegível']
];
export const TERMINAL_FOLDERS = [
  ['evidence', 'Evidências'],
  ['documents', 'Documentos'],
  ['records', 'Registros'],
  ['system', 'Sistema'],
  ['root', 'Raiz (solto na área de trabalho)']
];
const GLYPHS = '▒░▓█▌▐▄▀■¤§¶†‡¦';
const CORRUPT_RE = /[▒░▓█▌▐▄▀■¤§¶†‡¦]+/g;
const LEVEL_CFG = {
  partial: { ch: 0.16, word: 0.05, line: 0.03, name: 0, sectors: [0.12, 0.26] },
  severe: { ch: 0.5, word: 0.28, line: 0.16, name: 0.35, sectors: [0.5, 0.75] },
  total: { ch: 1, word: 1, line: 1, name: 0.7, sectors: [1, 1] }
};
export const normalizeLevel = l => (LEVEL_CFG[l] ? l : 'partial');

function hashSeed(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
export function seededRandom(seed) {
  let a = hashSeed(String(seed)) || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hexNoise(lines, r) {
  const g = () => GLYPHS[Math.floor(r() * GLYPHS.length)];
  const out = ['-- DUMP DE SETOR BRUTO · LEITURA FALHOU --'];
  let addr = Math.floor(r() * 255) * 16;
  for (let i = 0; i < lines; i++) {
    const bytes = Array.from({ length: 12 }, () => (r() < 0.4 ? '??' : Math.floor(r() * 256).toString(16).padStart(2, '0').toUpperCase()));
    const asc = Array.from({ length: 12 }, () => (r() < 0.55 ? g() : '.')).join('');
    out.push(`0x${addr.toString(16).toUpperCase().padStart(6, '0')}  ${bytes.join(' ')}  |${asc}|`);
    addr += 12;
  }
  return out.join('\n');
}
// Determinístico: o mesmo texto + semente gera sempre a mesma corrupção.
export function corruptText(text, level = 'partial', seed = 'x') {
  const src = String(text ?? '');
  level = normalizeLevel(level);
  const r = seededRandom(`${seed}:${level}`);
  if (level === 'total') return hexNoise(clamp(Math.ceil(src.split('\n').length * 1.2) + 6, 8, 26), r);
  const cfg = LEVEL_CFG[level];
  const g = () => GLYPHS[Math.floor(r() * GLYPHS.length)];
  return src.split('\n').map(line => {
    if (!line.trim()) return line;
    if (r() < cfg.line) return line.replace(/\S/g, g);
    return line.replace(/\S+/g, w => {
      if (Array.from(w).length > 2 && r() < cfg.word) return Array.from(w, g).join('');
      return Array.from(w, c => (/[\p{L}\p{N}]/u.test(c) && r() < cfg.ch ? g() : c)).join('');
    });
  }).join('\n');
}
export function corruptName(name, level = 'partial', seed = 'n') {
  const cfg = LEVEL_CFG[normalizeLevel(level)];
  if (!cfg.name) return String(name || '');
  const r = seededRandom(`${seed}:name:${level}`);
  const s = String(name || 'ARQUIVO');
  const dot = s.lastIndexOf('.');
  const base = dot > 0 ? s.slice(0, dot) : s, ext = dot > 0 ? s.slice(dot) : '';
  return Array.from(base, (c, i) => (i > 0 && /[\p{L}\p{N}]/u.test(c) && r() < cfg.name ? GLYPHS[Math.floor(r() * GLYPHS.length)] : c)).join('') + ext;
}
export function corruptionStats(key, level = 'partial') {
  level = normalizeLevel(level);
  const r = seededRandom(`${key}:stats`);
  const total = 32 + Math.floor(r() * 64);
  const [lo, hi] = LEVEL_CFG[level].sectors;
  const bad = level === 'total' ? total : Math.max(1, Math.round(total * (lo + r() * (hi - lo))));
  const hex4 = () => Math.floor(r() * 65536).toString(16).toUpperCase().padStart(4, '0');
  return { total, bad, code: `0x${(0x80070000 + Math.floor(r() * 0xFFFF)).toString(16).toUpperCase()}`, expected: hex4(), found: hex4() };
}
// Texto a ser salvo/exibido. Mantém `shown` salvo quando nada mudou.
export function buildCorruption(content, level, seed) { return corruptText(content, level, seed); }

function corruptHtml(shown) {
  const safe = esc(shown);
  if (safe.length > 9000) return safe;
  return safe.replace(CORRUPT_RE, m => `<span class="cx">${m}</span>`);
}

/* ───────────────────────── Ícones ───────────────────────── */

const SVG_OPEN = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">';
const FOLDER_GLYPH = {
  documents: '<path d="M17 28h14M17 33h9"/>',
  records: '<path d="M17 27l5 4-5 4M25 35h7"/>',
  evidence: '<circle cx="23" cy="30" r="4.5"/><path d="M26.5 33.5L31 38"/>',
  audio: '<path d="M17 33v-3M21 35v-7M25 34v-5M29 36v-9M33 33v-3"/>',
  system: '<circle cx="25" cy="31" r="3"/><path d="M25 24.5v2M25 35.5v2M18.5 31h2M29.5 31h2"/>',
  up: '<path d="M24 38V25M18 30l6-6 6 6"/>'
};
const FILE_GLYPH = {
  text: '<path d="M17 23h16M17 28h16M17 33h10" opacity=".75"/>',
  log: '<path d="M17 24l5 4-5 4M25 33h8"/>',
  audio: '<path d="M17 30v-3M21 33v-9M25 31v-5M29 34v-11M33 30v-3"/>',
  secret: '<rect x="18" y="26" width="14" height="10" rx="1"/><path d="M21 26v-3.5a4 4 0 018 0V26"/>',
  sys: '<circle cx="25" cy="29" r="4"/><path d="M25 21v3M25 34v3M17 29h3M30 29h3M19.4 23.4l2 2M28.6 32.6l2 2M30.6 23.4l-2 2M21.4 32.6l-2 2"/>'
};
export function folderIcon(id) {
  return `${SVG_OPEN}<path class="ico-fill" d="M5 12h12l4 4h22v24H5z" fill="currentColor" stroke="none"/><path d="M5 12h12l4 4h22v24H5z"/><path d="M5 20h38" opacity=".4"/>${FOLDER_GLYPH[id] || ''}</svg>`;
}
export function fileIcon(kind, corrupt = false) {
  const body = '<path d="M12 5h17l9 9v29H12z"/><path d="M29 5v9h9"/>';
  const ghost = corrupt ? '<path class="ico-ghost" d="M15 8h17l9 9v29H15z"/><path class="ico-crack" d="M26 5l-3 7 5 5-4 6 5 5-3 6 3 9"/>' : '';
  return `${SVG_OPEN}<path class="ico-fill" d="M12 5h17l9 9v29H12z" fill="currentColor" stroke="none"/>${ghost}${body}${corrupt ? '<path d="M17 24h5M26 24h7M17 29h9M30 29h3M17 34h4" opacity=".6"/>' : (FILE_GLYPH[kind] || FILE_GLYPH.text)}</svg>`;
}

/* ───────────────────────── Modelo do sistema de arquivos ───────────────────────── */

const FOLDER_META = [
  ['documents', 'Documentos', 'documentos'],
  ['records', 'Registros', 'registros'],
  ['evidence', 'Evidências', 'evidencias'],
  ['audio', 'Gravações', 'gravacoes'],
  ['system', 'Sistema', 'sistema']
];
const validFolder = f => (['documents', 'records', 'evidence', 'system', 'root'].includes(f) ? f : 'evidence');
const README = 'ASHEN OS :: README\n\nEste terminal foi recuperado de um arquivo isolado.\nLeia os registros disponíveis e compare as informações com as pistas da investigação.\n\nAlguns documentos permanecem protegidos por credenciais.\nArquivos marcados como CORROMPIDO podem estar parcial ou totalmente ilegíveis.';
const ACCESS_LOG = 'ASHEN OS :: ACCESS LOG\nSTATUS=AUTHENTICATED\nVOLUME=MOUNTED\nPRIVILEGE=RECOVERY_FILE\nNOTICE=All records shown here belong to this fictional investigation.';
const SYS_STATUS = 'ASHEN OS / RECOVERY SHELL\nAUTENTICAÇÃO: OK\nVOLUME: MONTADO\nACESSO: SOMENTE LEITURA\nREDE: CONECTADA';
const byteLen = s => { try { return new TextEncoder().encode(String(s || '')).length; } catch { return String(s || '').length; } };
export function fmtBytes(n) { n = Number(n) || 0; return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`; }

export function buildTerminalModel(puzzleId, unlocked) {
  const u = unlocked || {};
  const audios = Array.isArray(u.audioFiles) ? u.audioFiles : [];
  const extras = Array.isArray(u.extraFiles) ? u.extraFiles : [];
  const fc = u.fileCorruption && u.fileCorruption.corrupted ? u.fileCorruption : null;
  const items = [];
  items.push({ key: 'readme', name: 'LEIA-ME.txt', kind: 'text', folder: 'documents', text: README });
  items.push({ key: 'log', name: 'ACESSO.LOG', kind: 'log', folder: 'records', text: ACCESS_LOG });
  items.push({ key: 'sys', name: 'ESTADO.SYS', kind: 'sys', folder: 'system', text: SYS_STATUS });
  items.push({ key: 'secret', name: String(u.title || 'ARQUIVO_RECUPERADO.TXT'), kind: 'secret', folder: 'root', fresh: true, corrupted: !!fc, level: normalizeLevel(fc?.level), text: String(u.content || '') });
  extras.forEach((f, i) => {
    if (!f) return;
    items.push({ key: `x:${f.id || i}`, name: String(f.name || `ARQUIVO_${i + 1}.TXT`), kind: 'text', folder: validFolder(f.folder), corrupted: !!f.corrupted, level: normalizeLevel(f.level), text: String(f.corrupted ? (f.shown || '') : (f.content || '')) });
  });
  audios.forEach((a, i) => {
    items.push({ key: `audio:${i}`, name: String(a.name || `Gravação ${i + 1}`), kind: 'audio', folder: 'audio', size: Number(a.size) || 0, corrupted: !!a.corrupted, mode: a.corruptMode === 'dead' ? 'dead' : 'glitch', dataUrl: String(a.dataUrl || ''), level: a.corruptMode === 'dead' ? 'total' : 'partial' });
  });
  const byKey = new Map(items.map(it => [it.key, it]));
  const folders = FOLDER_META.map(([id, title, path]) => ({ id, title, path, items: items.filter(it => it.folder === id) }));
  return { puzzleId, items, byKey, folders, rootItems: items.filter(it => it.folder === 'root'), corruptedCount: items.filter(it => it.corrupted).length, audioCount: audios.length };
}
const folderPath = (model, cwd) => { const f = model.folders.find(x => x.id === cwd); return f ? `/recovered/${f.path}` : '/recovered'; };

/* ───────────────────────── Linha do tempo do boot ───────────────────────── */

export function bootLines(model, label) {
  const n = model?.items?.length || 4;
  const bad = model?.corruptedCount || 0;
  const L = (t, k = 'dim') => ({ t, k });
  const lines = [
    L('ASHEN OS RECOVERY KERNEL 4.19.0-ashen #1 SMP', 'head'),
    L('BIOS-e820: [mem 0x0000000000000000-0x000000000009fbff] usable'),
    L('BIOS-e820: [mem 0x0000000000100000-0x00000000bffdffff] usable'),
    L('ACPI: RSDP 0x00000000000F6A10 000024 (v02 ASHEN )'),
    L('[    0.004112] CPU0: recovered core, 2 threads @ 3.2GHz', 'info'),
    L('[    0.081207] mem: 512MB recovered / 64MB reserved', 'info'),
    L('[    0.120993] pci 0000:00:01.1: legacy IDE controller found', 'info'),
    L('[ OK ] Reached target Local File Systems', 'ok'),
    L('[ OK ] Started Journal Service', 'ok'),
    L('[ OK ] Started Entropy Daemon', 'ok'),
    L('[ OK ] Loaded Kernel Module: ashen_crypt', 'ok'),
    L('[ OK ] Loaded Kernel Module: ashen_audio', 'ok'),
    L('[  ..  ] Probing /dev/sda1 (encrypted volume)', 'info'),
    L('[ OK ] Verified volume signature', 'ok'),
    L('[ OK ] Credentials challenge: PASS', 'ok'),
    L(`[ OK ] Mounted /recovered (read-only) :: ${String(label || 'RESTRICTED NODE').slice(0, 48)}`, 'ok'),
    L('fsck.ashenfs /dev/sda1 -n', 'head'),
    L('  Pass 1: Checking inodes, blocks, and sizes', 'dim'),
    L('  Pass 2: Checking directory structure', 'dim'),
    L('  Pass 3: Checking directory connectivity', 'dim'),
    bad ? L(`[WARN] ${bad} arquivo(s) com setores ilegíveis (EIO)`, 'warn') : L('  Pass 4: Checking reference counts', 'dim'),
    bad ? L('[WARN] checksum mismatch — marcado como CORROMPIDO', 'warn') : L('  Pass 5: Checking group summary information', 'dim'),
    L(`[ OK ] Indexed ${n} file(s)`, 'ok'),
    L(`[ OK ] Indexed ${model?.audioCount || 0} audio recording(s)`, 'ok'),
    L('[ OK ] Applied read-only permissions', 'ok'),
    L('[ OK ] Started Network Link (session)', 'ok'),
    L('[ OK ] Started Display Manager', 'ok'),
    L('[ OK ] Reached target Recovery Desktop', 'ok'),
    L('STATUS: SISTEMA PRONTO', 'head')
  ];
  return lines;
}
export function bootTimeline(count) {
  const times = []; let at = 240;
  for (let i = 0; i < count; i++) { times.push(Math.round(at)); at += 118 - (i / count) * 78 + ((i * 37) % 5) * 5; }
  const logEnd = times[times.length - 1] + 420;
  const logoAt = logEnd;
  const progAt = logoAt + 250;
  const barMs = 1300;
  const grantAt = progAt + barMs;
  const outAt = grantAt + 650;
  return { times, logoAt, progAt, barMs, grantAt, outAt, total: outAt + 450 };
}
export function bootDuration(model, label) { return bootTimeline(bootLines(model, label).length).total; }

export function terminalBootMarkup(model, label, elapsed = 0) {
  const lines = bootLines(model, label), tl = bootTimeline(lines.length);
  const vars = `--el:${Math.round(elapsed)};--logo:${tl.logoAt};--prog:${tl.progAt};--bar:${tl.barMs};--grant:${tl.grantAt};--out:${tl.outAt}`;
  return `<div class="ashen-bt" role="status" aria-live="polite" style="${vars}"><div class="ashen-bt-log"><div class="ashen-bt-lines">${lines.map((l, i) => `<div class="bt-l bt-${l.k}" style="--t:${tl.times[i]}">${esc(l.t)}</div>`).join('')}</div></div><div class="ashen-bt-logo"><div class="bt-mark">◈</div><div class="bt-title" data-text="ASHEN OS">ASHEN OS</div><div class="bt-sub">RECOVERY ENVIRONMENT</div><div class="bt-bar"><i></i></div><div class="bt-status"><span class="bt-s1">MONTANDO VOLUME CRIPTOGRAFADO…</span><span class="bt-s2">ACESSO CONCEDIDO</span></div></div><button type="button" class="ashen-bt-skip" data-terminal-skip-boot>PULAR ▸</button><div class="ashen-bt-scan"></div></div>`;
}

/* ───────────────────────── Motor de áudio ───────────────────────── */

const PREF_KEY = 'ashen.terminal.audio.v2';
const prefs = { volume: 0.7, muted: false };
try { const raw = typeof localStorage !== 'undefined' && localStorage.getItem(PREF_KEY); if (raw) { const o = JSON.parse(raw); if (typeof o.volume === 'number') prefs.volume = clamp(o.volume, 0, 1); prefs.muted = !!o.muted; } } catch { /* sem storage */ }
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } };

let ctx = null, bus = null, out = null, noiseBuf = null, bootBufPromise = null;
function ensureGraph() {
  if (ctx) return ctx;
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) return null;
  try {
    ctx = new Ctx();
    out = ctx.createGain(); out.gain.value = prefs.muted ? 0 : prefs.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    bus = ctx.createGain(); bus.gain.value = 1;
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.17;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    bus.connect(comp); bus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(comp);
    comp.connect(out); out.connect(ctx.destination);
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}
export function termAudioPrime() {
  const c = ensureGraph();
  if (!c) return Promise.resolve(false);
  if (c.state === 'running') return Promise.resolve(true);
  return c.resume().then(() => c.state === 'running').catch(() => false);
}
export const termAudioPrefs = () => ({ ...prefs });
const volumeListeners = new Set();
function applyVolume() { if (out && ctx) out.gain.setTargetAtTime(prefs.muted ? 0 : prefs.volume, ctx.currentTime, 0.02); savePrefs(); volumeListeners.forEach(fn => { try { fn(); } catch { /* ignore */ } }); }
export function setTermVolume(v) { prefs.volume = clamp(Number(v) || 0, 0, 1); if (prefs.volume > 0) prefs.muted = false; applyVolume(); }
export function setTermMuted(m) { prefs.muted = !!m; applyVolume(); }

function tone(freq, o = {}) {
  const { t = 0, dur = 0.12, type = 'sine', gain = 0.06, attack = 0.004, slide = 0, to = bus } = o;
  const c = ctx, s = c.currentTime + 0.01 + t;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, s);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), s + dur);
  g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(gain, s + attack); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  osc.connect(g); g.connect(to); osc.start(s); osc.stop(s + dur + 0.03);
  return osc;
}
function noise(dur, o = {}) {
  const { t = 0, gain = 0.04, type = 'bandpass', freq = 3000, q = 1, sweep = 0, to = bus } = o;
  const c = ctx, s = c.currentTime + 0.01 + t;
  const src = c.createBufferSource(); src.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, s);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), s + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(gain, s + Math.min(0.006, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  src.connect(f); f.connect(g); g.connect(to); src.start(s, Math.random() * 1.5, dur + 0.05);
}
const SFX = {
  click: () => { tone(1900, { dur: 0.03, type: 'square', gain: 0.03 }); noise(0.02, { gain: 0.03, freq: 5200, q: 0.8 }); },
  key: () => { noise(0.02, { gain: 0.03, freq: 3400 + Math.random() * 1400, q: 2 }); tone(820 + Math.random() * 260, { dur: 0.02, type: 'triangle', gain: 0.018 }); },
  folder: () => { noise(0.14, { gain: 0.035, freq: 500, sweep: 2600, q: 1.2 }); tone(380, { dur: 0.1, type: 'triangle', gain: 0.04, slide: 760 }); },
  open: () => { tone(520, { dur: 0.07, type: 'triangle', gain: 0.05 }); tone(780, { t: 0.06, dur: 0.1, type: 'triangle', gain: 0.05 }); noise(0.05, { gain: 0.02, freq: 2500 }); },
  close: () => { tone(700, { dur: 0.06, type: 'triangle', gain: 0.045 }); tone(440, { t: 0.05, dur: 0.1, type: 'triangle', gain: 0.045 }); },
  scan: () => { noise(0.03, { gain: 0.03, freq: 2200 + Math.random() * 1600, q: 3 }); tone(1400 + Math.random() * 700, { dur: 0.02, gain: 0.012 }); },
  denied: () => { tone(160, { dur: 0.16, type: 'sawtooth', gain: 0.05, slide: 120 }); tone(130, { t: 0.2, dur: 0.24, type: 'sawtooth', gain: 0.055, slide: 80 }); noise(0.3, { gain: 0.025, freq: 400, type: 'lowpass' }); },
  granted: () => { [659.25, 830.61, 987.77, 1318.51].forEach((f, i) => tone(f, { t: i * 0.085, dur: i === 3 ? 0.7 : 0.2, type: 'sine', gain: i === 3 ? 0.05 : 0.04 })); noise(0.12, { gain: 0.012, freq: 6000, type: 'highpass' }); },
  error: () => {
    noise(0.38, { gain: 0.06, type: 'highpass', freq: 3200, sweep: 700 });
    tone(240, { dur: 0.42, type: 'sawtooth', gain: 0.045, slide: 60 });
    [0, 0.09, 0.18].forEach(t => noise(0.04, { t, gain: 0.05, freq: 900 + t * 6000, q: 4 }));
  }
};
export function sfx(name) {
  if (prefs.muted || prefs.volume <= 0) return;
  const c = ensureGraph(); if (!c || !SFX[name]) return;
  const play = () => { try { SFX[name](); } catch { /* ignore */ } };
  if (c.state === 'running') play(); else c.resume().then(play).catch(() => {});
}
let lastKey = 0;
export function sfxKey() { const n = Date.now(); if (n - lastKey < 40) return; lastKey = n; sfx('key'); }

/* Boot: camada do MP3 existente (acorde) + hum, relé, ticks por linha, seeks de disco, sweep e chime sincronizados. */
let bootNodes = [], bootGain = null, bootFallback = null;
export function stopBootSound() {
  try { if (bootGain && ctx) { bootGain.gain.cancelScheduledValues(ctx.currentTime); bootGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06); } } catch { /* ignore */ }
  const nodes = bootNodes; bootNodes = []; bootGain = null;
  setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch { /* ignore */ } try { n.disconnect(); } catch { /* ignore */ } }), 400);
  if (bootFallback) { try { bootFallback.pause(); } catch { /* ignore */ } bootFallback = null; }
}
export function playBootSound(model, label) {
  stopBootSound();
  if (prefs.muted || prefs.volume <= 0) return;
  const lines = bootLines(model, label), tl = bootTimeline(lines.length);
  const c = ensureGraph();
  if (!c) { try { bootFallback = new Audio('/terminal-startup.mp3'); bootFallback.volume = prefs.volume * 0.7; bootFallback.play().catch(() => {}); } catch { /* ignore */ } return; }
  const go = () => {
    if (c.state !== 'running') return;
    const T0 = c.currentTime + 0.05, startedAt = performance.now();
    bootGain = c.createGain(); bootGain.gain.value = 1; bootGain.connect(bus);
    const reg = n => { bootNodes.push(n); return n; };
    const env = (g, pts) => { g.gain.setValueAtTime(0.0001, T0); pts.forEach(([t, v]) => g.gain.linearRampToValueAtTime(Math.max(0.0001, v), T0 + t)); };
    // acorde de fundo (MP3 do projeto), decodificado uma vez
    if (!bootBufPromise) bootBufPromise = fetch('/terminal-startup.mp3').then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('mp3')))).then(b => c.decodeAudioData(b)).catch(() => null);
    bootBufPromise.then(buf => {
      if (!buf || !bootGain) return;
      const off = Math.max(0, (performance.now() - startedAt) / 1000 - 0.05);
      if (off >= buf.duration) return;
      const s = reg(c.createBufferSource()); s.buffer = buf; const g = c.createGain(); g.gain.value = 0.5; s.connect(g); g.connect(bootGain); s.start(0, off);
    });
    // hum grave
    const hum = c.createGain(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; hum.connect(lp); lp.connect(bootGain);
    [[48, 'sawtooth', 1], [96.4, 'square', 0.35]].forEach(([f, ty, m]) => { const o = reg(c.createOscillator()); o.type = ty; o.frequency.value = f; const og = c.createGain(); og.gain.value = m; o.connect(og); og.connect(hum); o.start(T0); o.stop(T0 + tl.logoAt / 1000 + 0.6); });
    env(hum, [[0.5, 0.05], [tl.logoAt / 1000 - 0.3, 0.04], [tl.logoAt / 1000 + 0.5, 0.0001]]);
    // relé + thump
    noise(0.07, { gain: 0.11, freq: 320, q: 0.7, to: bootGain });
    tone(72, { dur: 0.3, gain: 0.13, slide: 38, to: bootGain });
    // ticks por linha
    tl.times.forEach((t, i) => {
      const k = lines[i]?.k;
      noise(0.012, { t: t / 1000, gain: k === 'head' ? 0.03 : 0.017, freq: 3600 + ((i * 331) % 2400), q: 3, to: bootGain });
      if (k === 'ok' && i % 2 === 0) tone(2300 + ((i * 97) % 500), { t: t / 1000, dur: 0.018, gain: 0.007, to: bootGain });
      if (k === 'warn') tone(220, { t: t / 1000, dur: 0.12, type: 'square', gain: 0.02, to: bootGain });
    });
    // seeks de disco
    [0.9, 1.7, 2.45].forEach(base => { for (let j = 0; j < 7; j++) noise(0.022, { t: base + j * 0.035, gain: 0.024, freq: 1500 + ((j * 613) % 1400), q: 5, to: bootGain }); });
    // sweep ascendente durante o logo + chime de acesso
    tone(180, { t: tl.logoAt / 1000, dur: (tl.grantAt - tl.logoAt) / 1000, type: 'sine', gain: 0.03, slide: 1500, to: bootGain });
    [659.25, 830.61, 987.77, 1318.51].forEach((f, i) => tone(f, { t: tl.grantAt / 1000 + i * 0.09, dur: i === 3 ? 0.9 : 0.22, type: 'sine', gain: i === 3 ? 0.055 : 0.04, to: bootGain }));
  };
  if (c.state === 'running') go(); else c.resume().then(go).catch(() => {});
}

/* ───────────────────────── Player de gravações ───────────────────────── */

const registry = new Map();
function dataUrlToBlobUrl(dataUrl) {
  const m = /^data:(audio\/[a-z0-9.+-]+)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
  if (!m) return '';
  try { const bin = atob(m[2].replace(/\s/g, '')); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return URL.createObjectURL(new Blob([arr], { type: m[1] })); } catch { return ''; }
}
function destroyEntry(e) { clearInterval(e.timer); cancelAnimationFrame(e.raf); try { e.audio.pause(); } catch { /* ignore */ } try { e.noiseSrc?.stop(); } catch { /* ignore */ } try { e.src?.disconnect(); } catch { /* ignore */ } try { URL.revokeObjectURL(e.url); } catch { /* ignore */ } }
export function disposeAudioPlayers() { registry.forEach(destroyEntry); registry.clear(); }
export function pauseAudioPlayers() { registry.forEach(e => { try { e.audio.pause(); } catch { /* ignore */ } }); }

function crushCurve() { const n = 256, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * 6) / 6 * 0.9 + Math.tanh(x * 3) * 0.1; } return c; }
function attachGraph(e) {
  if (e.attached) return true;
  const c = ensureGraph(); if (!c) return false;
  try { e.src = c.createMediaElementSource(e.audio); } catch { return false; }
  e.attached = true;
  e.analyser = c.createAnalyser(); e.analyser.fftSize = 128; e.analyser.smoothingTimeConstant = 0.78;
  let node = e.src;
  if (e.mode === 'glitch') {
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 240;
    const sh = c.createWaveShaper(); sh.curve = crushCurve();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    e.gate = c.createGain();
    node.connect(hp); hp.connect(sh); sh.connect(lp); lp.connect(e.gate); node = e.gate;
    e.noiseSrc = c.createBufferSource(); e.noiseSrc.buffer = noiseBuf; e.noiseSrc.loop = true;
    const nb = c.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 2800; nb.Q.value = 0.6;
    e.noiseGain = c.createGain(); e.noiseGain.gain.value = 0;
    e.noiseSrc.connect(nb); nb.connect(e.noiseGain); e.noiseGain.connect(e.analyser); e.noiseSrc.start();
  }
  node.connect(e.analyser); e.analyser.connect(out);
  return true;
}
function glitchStart(e) {
  if (e.mode !== 'glitch' || !ctx) return;
  clearInterval(e.timer);
  if (e.noiseGain) e.noiseGain.gain.setTargetAtTime(0.02, ctx.currentTime, 0.05);
  e.timer = setInterval(() => {
    const now = ctx.currentTime, r = Math.random();
    if (r < 0.2 && e.gate) { const d = 0.04 + Math.random() * 0.22; e.gate.gain.setValueAtTime(0, now); e.gate.gain.setValueAtTime(1, now + d); if (e.noiseGain) { e.noiseGain.gain.setValueAtTime(0.07, now); e.noiseGain.gain.setTargetAtTime(0.02, now + d, 0.05); } }
    else if (r < 0.27) { try { e.audio.currentTime = Math.max(0, e.audio.currentTime - (0.08 + Math.random() * 0.2)); } catch { /* ignore */ } }
    else if (r < 0.4) e.audio.playbackRate = 0.93 + Math.random() * 0.14; else e.audio.playbackRate = 1;
  }, 150);
}
function glitchStop(e) { clearInterval(e.timer); e.audio.playbackRate = 1; try { e.gate?.gain.cancelScheduledValues(0); e.gate?.gain.setValueAtTime(1, ctx.currentTime); e.noiseGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.03); } catch { /* ignore */ } }
function getEntry(key, item) {
  let e = registry.get(key);
  if (e) return e;
  const url = dataUrlToBlobUrl(item.dataUrl); if (!url) return null;
  const audio = new Audio(); audio.preload = 'metadata'; audio.src = url;
  e = { key, audio, url, mode: item.mode === 'dead' ? 'dead' : (item.corrupted ? 'glitch' : 'clean'), ui: null };
  const sync = () => e.ui && e.ui.sync();
  ['timeupdate', 'loadedmetadata', 'durationchange', 'play', 'pause', 'ended'].forEach(ev => audio.addEventListener(ev, sync));
  audio.addEventListener('play', () => glitchStart(e)); audio.addEventListener('pause', () => glitchStop(e)); audio.addEventListener('ended', () => glitchStop(e));
  registry.set(key, e);
  return e;
}
const fmtTime = s => { s = Math.max(0, Math.floor(Number(s) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function audioPlayerMarkup(item) {
  const glitch = !!item.corrupted;
  return `<div class="ashen-aplayer ${glitch ? 'is-glitch' : ''}" data-aplayer="${esc(item.key)}"><canvas class="ashen-aplayer-viz" width="480" height="96" aria-hidden="true"></canvas><div class="ashen-aplayer-meta"><b>${esc(item.name)}</b><small>${glitch ? '⚠ SINAL DEGRADADO · RECUPERAÇÃO PARCIAL' : 'GRAVAÇÃO RECUPERADA'} · ${esc(fmtBytes(item.size))}</small></div><div class="ashen-aplayer-ctl"><button type="button" class="ap-play" data-ap="toggle" aria-label="Reproduzir">▶</button><input type="range" class="ap-seek" data-ap="seek" min="0" max="1000" value="0" aria-label="Posição"><span class="ap-time" data-ap="time">0:00 / 0:00</span><button type="button" class="ap-mute" data-ap="mute" aria-label="Silenciar">♪</button><input type="range" class="ap-vol" data-ap="vol" min="0" max="100" aria-label="Volume"></div></div>`;
}
export function bindAudioPlayers(root, resolve) {
  root.querySelectorAll('[data-aplayer]').forEach(box => {
    const key = box.dataset.aplayer, item = resolve(key); if (!item) return;
    const e = getEntry(key, item); if (!e) { box.querySelector('.ashen-aplayer-meta small').textContent = 'ARQUIVO DE ÁUDIO INVÁLIDO'; return; }
    const $ = n => box.querySelector(`[data-ap="${n}"]`);
    const play = $('toggle'), seek = $('seek'), time = $('time'), mute = $('mute'), vol = $('vol'), cv = box.querySelector('canvas');
    let dragging = false;
    const sync = () => {
      const a = e.audio, d = Number.isFinite(a.duration) ? a.duration : 0;
      play.textContent = a.paused ? '▶' : '❚❚'; play.setAttribute('aria-label', a.paused ? 'Reproduzir' : 'Pausar');
      if (!dragging) seek.value = d ? String(Math.round(a.currentTime / d * 1000)) : '0';
      time.textContent = `${fmtTime(a.currentTime)} / ${fmtTime(d)}`;
    };
    const syncVol = () => { vol.value = String(Math.round((prefs.muted ? 0 : prefs.volume) * 100)); mute.textContent = prefs.muted || prefs.volume === 0 ? '✕' : '♪'; };
    e.ui = { sync }; sync(); syncVol();
    play.onclick = async () => {
      await termAudioPrime();
      if (!attachGraph(e)) { /* sem Web Audio: toca direto */ }
      if (e.audio.paused) { e.audio.play().catch(() => {}); sfx('click'); } else e.audio.pause();
    };
    seek.oninput = () => { dragging = true; const d = e.audio.duration; if (Number.isFinite(d)) e.audio.currentTime = d * Number(seek.value) / 1000; };
    seek.onchange = () => { dragging = false; sync(); };
    vol.oninput = () => setTermVolume(Number(vol.value) / 100);
    mute.onclick = () => { if (prefs.muted || prefs.volume === 0) { if (prefs.volume === 0) prefs.volume = 0.7; setTermMuted(false); } else setTermMuted(true); };
    volumeListeners.add(syncVol);
    // visualizador
    cancelAnimationFrame(e.raf);
    const g = cv.getContext('2d'), accent = box.classList.contains('is-glitch') ? '#e0a46a' : '#aacfd1';
    const bins = new Uint8Array(64);
    const draw = () => {
      if (!cv.isConnected) { volumeListeners.delete(syncVol); return; }
      const w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
      const playing = !e.audio.paused && e.analyser;
      if (playing) e.analyser.getByteFrequencyData(bins);
      const n = 48, bw = w / n; const t = performance.now() / 1000;
      for (let i = 0; i < n; i++) {
        const v = playing ? bins[Math.min(63, Math.floor(i * 0.9))] / 255 : 0.04 + 0.02 * Math.sin(t * 2 + i * 0.5);
        const bh = Math.max(2, v * h * 0.92);
        g.fillStyle = accent; g.globalAlpha = 0.25 + v * 0.75; g.fillRect(i * bw + 1, h - bh, bw - 3, bh);
        g.globalAlpha = 0.12; g.fillRect(i * bw + 1, h - bh - 4, bw - 3, 2);
      }
      g.globalAlpha = 1; e.raf = requestAnimationFrame(draw);
    };
    draw();
  });
}
export function bindTerminalAudioUi(root) {
  root.querySelectorAll('[data-terminal-volume]').forEach(r => { r.oninput = () => setTermVolume(Number(r.value) / 100); });
  root.querySelectorAll('[data-terminal-mute]').forEach(b => { b.onclick = () => { setTermMuted(!prefs.muted); sfx('click'); }; });
  const sync = () => {
    root.querySelectorAll('[data-terminal-volume]').forEach(r => { r.value = String(Math.round((prefs.muted ? 0 : prefs.volume) * 100)); });
    root.querySelectorAll('[data-terminal-mute]').forEach(b => { b.textContent = prefs.muted || prefs.volume === 0 ? '✕ MUDO' : '♪ SOM'; b.setAttribute('aria-pressed', String(!!prefs.muted)); });
  };
  volumeListeners.add(sync); sync();
}
export function bindLoginSfx(root) { root.querySelectorAll('.ashen-terminal-auth-form input').forEach(i => i.addEventListener('input', sfxKey)); }

/* ───────────────────────── Relógio / fsck ───────────────────────── */

let clockTimer = null;
const pad2 = n => String(n).padStart(2, '0');
export const clockText = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
export function startTerminalClock() {
  if (clockTimer) return;
  const tick = () => {
    const els = document.querySelectorAll('[data-term-clock]');
    if (!els.length) { clearInterval(clockTimer); clockTimer = null; return; }
    const t = clockText(); els.forEach(e => { e.textContent = t; });
    document.querySelectorAll('[data-term-since]').forEach(e => { const s = Math.max(0, Math.floor((Date.now() - Number(e.dataset.termSince)) / 1000)); e.textContent = `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`; });
  };
  clockTimer = setInterval(tick, 1000);
}
export function runFsckSim(box) {
  if (!box || box.dataset.running === '1') return;
  box.dataset.running = '1';
  const bar = box.querySelector('i'), outEl = box.querySelector('[data-fsck-out]'), level = normalizeLevel(box.dataset.level);
  const steps = ['Lendo tabela de alocação…', 'Verificando checksums por setor…', 'Tentando reconstruir blocos…', 'Reconstruindo árvore de inodes…'];
  const stopAt = 55 + Math.random() * 37; let pct = 0, step = 0;
  const id = setInterval(() => {
    if (!box.isConnected) { clearInterval(id); return; }
    pct += Math.random() * 8 + 3; sfx('scan');
    if (pct >= stopAt) {
      clearInterval(id); bar.style.width = `${stopAt.toFixed(0)}%`; box.dataset.running = ''; box.classList.add('is-failed'); sfx('error');
      outEl.textContent = level === 'total' ? 'REPARO FALHOU · dados irrecuperáveis (EIO)' : 'REPARO PARCIAL · os setores restantes não puderam ser reconstruídos';
      return;
    }
    bar.style.width = `${pct.toFixed(0)}%`;
    const s = Math.min(steps.length - 1, Math.floor(pct / (stopAt / steps.length))); if (s !== step || !outEl.textContent) { step = s; outEl.textContent = steps[s]; }
  }, 170);
}

/* ───────────────────────── Markup do desktop ───────────────────────── */

const LEVEL_LABEL = { partial: 'PARCIAL', severe: 'FRAGMENTOS', total: 'ILEGÍVEL' };
function tileMarkup(pid, t, i) {
  const attr = t.cd !== undefined ? `data-terminal-cd="${esc(t.cd)}"` : `data-terminal-open-file="${esc(t.key)}"`;
  const label = t.corrupted ? corruptName(t.name, t.level, t.key) : t.name;
  return `<button type="button" class="ashen-fs-tile ${t.folder ? 'is-folder' : 'is-file'} ${t.corrupted ? 'is-corrupt' : ''} ${t.fresh ? 'is-new' : ''} ${t.warn ? 'has-warn' : ''}" ${attr} data-terminal-puzzle="${esc(pid)}" style="--i:${i}" title="${esc(t.name)}"><span class="ashen-fs-ico">${t.icon}</span><b ${t.corrupted ? `class="glitch-name" data-text="${esc(label)}"` : ''}>${esc(label)}</b>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}${t.corrupted ? '<em class="ashen-fs-flag">CORROMPIDO</em>' : ''}${t.fresh && !t.corrupted ? '<em class="ashen-fs-flag is-new">NOVO</em>' : ''}</button>`;
}
function fsMarkup(pid, model, ui) {
  const cwd = ui.cwd || '';
  const tiles = [];
  if (cwd) {
    const f = model.folders.find(x => x.id === cwd);
    tiles.push({ cd: '', name: '..', icon: folderIcon('up'), sub: 'VOLTAR', folder: true });
    (f?.items || []).forEach(it => tiles.push({ key: it.key, name: it.name, icon: fileIcon(it.kind, it.corrupted), corrupted: it.corrupted, level: it.level, sub: it.kind === 'audio' ? (it.corrupted ? (it.mode === 'dead' ? 'ÁUDIO · ILEGÍVEL' : 'ÁUDIO · DEGRADADO') : `ÁUDIO · ${fmtBytes(it.size)}`) : (it.corrupted ? LEVEL_LABEL[it.level] : fmtBytes(byteLen(it.text))), kind: it.kind }));
  } else {
    model.folders.forEach(f => tiles.push({ cd: f.id, name: f.title, icon: folderIcon(f.id), sub: `${f.items.length} ${f.items.length === 1 ? 'ITEM' : 'ITENS'}`, folder: true, warn: f.items.some(x => x.corrupted) }));
    model.rootItems.forEach(it => tiles.push({ key: it.key, name: it.name, icon: fileIcon(it.kind, it.corrupted), corrupted: it.corrupted, level: it.level, fresh: it.fresh, sub: it.corrupted ? LEVEL_LABEL[it.level] : fmtBytes(byteLen(it.text)) }));
  }
  const pct = 38 + (hashSeed(`${pid}:mount`) % 41);
  return `<section class="ashen-fs ${ui.fresh ? 'is-entering' : ''}" aria-label="Sistema de arquivos"><header class="ashen-fs-head"><span class="ashen-fs-title">FILESYSTEM</span><span class="ashen-fs-path">${esc(folderPath(model, cwd))}</span><span class="ashen-fs-count">${tiles.length - (cwd ? 1 : 0)} ITENS</span></header><div class="ashen-fs-grid">${tiles.map((t, i) => tileMarkup(pid, t, i)).join('')}</div><footer class="ashen-fs-foot"><span>MOUNT /recovered USED ${pct}%</span><i><u style="width:${pct}%"></u></i><span>RO</span></footer></section>`;
}
function viewerMarkup(pid, item, model) {
  const path = `${folderPath(model, item.folder === 'root' ? '' : item.folder)}/${item.name}`;
  const head = `<header><span class="ashen-view-title"><span class="ashen-view-ico ${item.corrupted ? 'is-corrupt' : ''}">${fileIcon(item.kind, item.corrupted)}</span><span><b>${esc(item.corrupted ? corruptName(item.name, item.level, item.key) : item.name)}</b><small>${esc(path)}</small></span></span><button type="button" class="ashen-terminal-window-close" data-terminal-close-file="${esc(pid)}" aria-label="Fechar arquivo">×</button></header>`;
  let body, foot;
  if (item.kind === 'audio') {
    if (item.corrupted && item.mode === 'dead') {
      const st = corruptionStats(item.key, 'total');
      body = `<div class="ashen-view-corrupt"><div class="ashen-corrupt-banner"><strong>⚠ GRAVAÇÃO CORROMPIDA</strong><span>FALHA DE DECODIFICAÇÃO · ${esc(st.code)}</span></div><pre class="ashen-view-text is-corrupt">${esc(corruptText('', 'total', item.key))}</pre></div>`;
      foot = '<span>CODEC ERROR · NO STREAM</span><span>READ ONLY</span>';
    } else { body = audioPlayerMarkup({ ...item, key: `${pid}|${item.key}` }); foot = `<span>${item.corrupted ? 'DEGRADED SIGNAL' : 'RECOVERED AUDIO'}</span><span>READ ONLY</span>`; }
  } else if (item.corrupted) {
    const st = corruptionStats(item.key, item.level);
    body = `<div class="ashen-view-corrupt"><div class="ashen-corrupt-banner"><strong>⚠ ARQUIVO CORROMPIDO</strong><span>ERRO ${esc(st.code)} · CHECKSUM ${esc(st.expected)} ≠ ${esc(st.found)} · SETORES ILEGÍVEIS ${st.bad}/${st.total}</span></div><pre class="ashen-view-text is-corrupt">${corruptHtml(item.text)}</pre><div class="ashen-fsck" data-fsck data-level="${esc(item.level)}"><button type="button" data-terminal-fsck>EXECUTAR REPARO (fsck)</button><div class="ashen-fsck-bar"><i></i></div><span data-fsck-out></span></div></div>`;
    foot = '<span>EIO · INPUT/OUTPUT ERROR</span><span>READ ONLY</span>';
  } else { body = `<pre class="ashen-view-text">${esc(item.text)}</pre>`; foot = `<span>${esc(fmtBytes(byteLen(item.text)))} · READ ONLY</span><span>ASHEN OS / RECOVERY SHELL</span>`; }
  return `<section class="ashen-view ${item.corrupted ? 'is-corrupt' : ''}" aria-label="Arquivo ${esc(item.name)}">${head}${body}<footer>${foot}</footer></section>`;
}
function consoleMarkup(p, model, ui) {
  const prompt = `ash@ashen-os:${folderPath(model, ui.cwd || '')}$`;
  const hist = (ui.history || []).slice(-6).map(h => `${esc(`ash@ashen-os:${h.path}$`)} ${esc(h.cmd)}${h.out ? `\n${esc(h.out)}` : ''}${h.err ? `\n<span class="t-err">${esc(h.err)}</span>` : ''}`).join('\n');
  const warn = model.corruptedCount ? `\n<span class="t-warn">[WARN] ${model.corruptedCount} arquivo(s) corrompido(s) detectado(s)</span>` : '';
  return `<div class="ashen-terminal-console"><pre aria-label="Saída do terminal">ash@ashen-os:~$ status --verbose\n\nSYSTEM       ASHEN OS / RECOVERY SHELL\nACCESS       AUTHENTICATED\nVOLUME       MOUNTED\nTERMINAL     ${esc(p.terminalLabel || p.title || 'RESTRICTED NODE')}\n\n[ OK ] Credentials verified\n[ OK ] Encrypted volume mounted\n[ OK ] File index recovered${warn}\n${hist ? `\n${hist}\n` : '\n'}${esc(prompt)} <span class="ashen-terminal-cursor">▌</span></pre></div>`;
}
export function terminalCommand(action, model, key, cwd = '') {
  const path = folderPath(model, cwd);
  if (action === 'cd') { const f = model.folders.find(x => x.id === key); return key ? { path, cmd: `cd ${f?.path || key} && ls`, out: `${f?.items.length || 0} item(ns)` } : { path, cmd: 'cd .. && ls', out: '' }; }
  const it = model.byKey.get(key); if (!it) return null;
  const cwdPath = folderPath(model, it.folder === 'root' ? '' : it.folder);
  if (it.kind === 'audio') return it.corrupted && it.mode === 'dead' ? { path: cwdPath, cmd: `play "${it.name}"`, err: 'play: falha de decodificação (EIO)' } : { path: cwdPath, cmd: `play "${it.name}"`, out: it.corrupted ? 'aviso: sinal degradado' : '' };
  return it.corrupted ? { path: cwdPath, cmd: `cat "${it.name}"`, err: 'cat: erro de leitura: erro de entrada/saída (EIO)' } : { path: cwdPath, cmd: `cat "${it.name}"`, out: '' };
}

export function terminalDesktopMarkup(p, unlocked, ui = {}) {
  const pid = String(p.id), model = buildTerminalModel(pid, unlocked);
  const label = p.terminalLabel || p.title || 'RESTRICTED NODE';
  const opened = ui.openKey ? model.byKey.get(ui.openKey) : null;
  const prefsNow = termAudioPrefs();
  const since = Number(ui.since) || Date.now();
  return `<section class="ashen-terminal-os is-desktop" data-terminal-os="${esc(pid)}" aria-label="Terminal autenticado ${esc(label)}"><header class="ashen-terminal-topbar"><span>ASHEN OS <i>RECOVERY SHELL</i></span><span class="ashen-terminal-top-status"><b></b> ACCESS GRANTED</span><span class="ashen-term-audio"><button type="button" data-terminal-mute class="ashen-terminal-sound" aria-pressed="${prefsNow.muted}">♪ SOM</button><input type="range" min="0" max="100" value="${Math.round(prefsNow.volume * 100)}" data-terminal-volume aria-label="Volume do terminal"><button type="button" class="ashen-terminal-sound" data-terminal-reboot="${esc(pid)}" title="Reiniciar a animação de boot" aria-label="Reiniciar boot">↻</button></span></header>${ui.booting ? terminalBootMarkup(model, label, ui.bootElapsed || 0) : ''}<div class="ashen-terminal-workspace"><aside class="ashen-terminal-telemetry"><div class="ashen-terminal-clock"><small>SYS.TIME</small><strong data-term-clock>${clockText()}</strong><span>UPTIME · <b data-term-since="${since}">00:00:00</b></span></div><div class="ashen-terminal-meter"><small>CPU PROCESS</small><div><i class="wob" style="width:38%"></i></div><small>MEMORY CACHE</small><div><i class="wob" style="width:61%;animation-delay:-1.3s"></i></div></div><div class="ashen-terminal-tiny-list"><b>SYSTEM CHECK</b><span>AUTH ........ OK</span><span>FILES ........ ${model.corruptedCount ? 'DAMAGED' : 'READY'}</span><span>ENCRYPTION .. ON</span><span>USER ........ OPERATOR</span></div><div class="ashen-terminal-vertical-note">RECOVERED DEVICE // BUILD 04.19</div></aside><main class="ashen-terminal-main"><div class="ashen-terminal-tabs"><span>MAIN SHELL</span><span>RECOVERED FILES</span><span>RECOVERY SYSTEM</span></div><div class="ashen-terminal-stage ${opened ? 'has-view' : ''}">${consoleMarkup(p, model, ui)}${opened ? viewerMarkup(pid, opened, model) : ''}</div>${fsMarkup(pid, model, ui)}</main><aside class="ashen-terminal-network"><div class="ashen-network-status"><small>NETWORK STATUS</small><strong><b></b> SESSION LINK</strong><span>STATE <i>ONLINE</i></span><span>ACCESS <i>AUTHORIZED</i></span><span>ENCRYPTION <i>ACTIVE</i></span></div><div class="ashen-network-map"><small>WORLD VIEW</small><div class="ashen-network-globe" aria-hidden="true">◎<i></i></div><span>ENDPOINT: LOCAL DEVICE</span></div><div class="ashen-network-chart"><small>NETWORK TRAFFIC</small><svg viewBox="0 0 160 44" role="img" aria-label="Gráfico decorativo de atividade"><path class="flow" d="M0 30 L20 22 L36 32 L53 12 L72 28 L91 24 L109 35 L128 18 L145 23 L160 13"/><path d="M0 38 L23 35 L39 39 L58 30 L76 36 L97 31 L115 38 L139 33 L160 36"/></svg></div></aside></div><footer class="ashen-terminal-footer"><span>ASHEN TESTIMONY // RECOVERY TERMINAL</span><span>FILES ARE ACCESS CONTROLLED</span></footer></section>`;
}
export { esc as terminalEsc };
