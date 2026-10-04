// Auditoria de XSS: procura interpolações ${...} dentro de template literals que montam HTML
// e sinaliza as que NÃO passam por um escapador conhecido. Executa de verdade sobre o app.js.
import { readFileSync } from 'node:fs';

const file = process.argv.slice(2).find(a => !a.startsWith('--')) || 'app.js';
const src = readFileSync(file, 'utf8');

// Escapadores / conversores considerados seguros
const SAFE_CALL = /^(esc|escAttr|safeImgSrc|safeUrl|safeMediaSrc|imageValue|Number|parseInt|parseFloat|Math\.\w+|String\(\s*Number|encodeURIComponent|JSON\.stringify)\s*\(/;
const NUMERIC = /^[\d\s+\-*/().%]+$/;
const SAFE_IDENT = /^(i|j|k|n|idx|index|page|pages|round|total|count|len|pct|percent|max|min|val|num|hp|san|hpMax|sanMax|level|lvl)$/;

function skipString(s, i, q) { i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } return i; }
// varre uma expressão ${ ... } respeitando strings/templates aninhados; devolve índice do '}' final
function scanExpr(s, i) {
  let depth = 1;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"') { i = skipString(s, i, c); continue; }
    if (c === '`') { i = scanTemplate(s, i).end; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return s.length;
}
// varre template literal a partir da crase; devolve {end, parts:[{text}], exprs:[{code,pos}]}
function scanTemplate(s, i) {
  const start = i; i++;
  const exprs = []; let text = '';
  while (i < s.length && s[i] !== '`') {
    if (s[i] === '\\') { text += s[i] + (s[i + 1] || ''); i += 2; continue; }
    if (s[i] === '$' && s[i + 1] === '{') {
      const e = scanExpr(s, i + 2);
      exprs.push({ code: s.slice(i + 2, e), pos: i, textBefore: text });
      text += '\u0000'; i = e + 1; continue;
    }
    text += s[i]; i++;
  }
  return { start, end: i, text, exprs };
}

function lineOf(pos) { let n = 1; for (let k = 0; k < pos; k++) if (src.charCodeAt(k) === 10) n++; return n; }

const NUMERIC_CALL = /^(clamp|effectiveAttr|effectiveSkill|derivedMax|spellCost|resourceState|punchDamage|damageFor|calc\w*|total\w*|count\w*|round\w*)\s*\(/;
function isSafeExpr(code) {
  const c = code.trim();
  if (!c) return true;
  // template literal inteiro ou literal de texto sem interpolação: o conteúdo é auditado como template próprio
  if (/^`/.test(c) && scanTemplate(c, 0).end === c.length - 1) return true;
  if (/^(['"])(?:(?!\1)[^\\]|\\.)*\1$/.test(c)) return true;
  const plus = splitPlus(c);
  if (plus && plus.length > 1) return plus.every(isSafeExpr);
  if (/\.length$/.test(c) || /^[\w.$]+\.length\s*[-+*]?\s*\d*$/.test(c)) return true;
  if (/^\w+\s*[+\-*/%]\s*\d+$/.test(c)) return true;
  if (NUMERIC_CALL.test(c) && closesAtEnd(c)) return true;
  if (/^(!?[\w.$\[\]'"]+\s*(===|!==|==|!=|>=|<=|>|<)\s*[\w.$'"\[\]]+)$/.test(c)) return true; // comparação -> booleano/rótulo controlado
  if (SAFE_CALL.test(c) && closesAtEnd(c)) return true;
  if (NUMERIC.test(c) || SAFE_IDENT.test(c)) return true;
  if (/^['"`][^'"`$\\<>&]*['"`]$/.test(c)) return true;      // literal simples
  // ternário/&&/|| : todos os ramos precisam ser seguros
  const t = splitTop(c);
  if (t) return t.every(isSafeExpr);
  // .map(...).join('') -> depende do template interno (auditado à parte, pois é template próprio)
  if (/\.map\(/.test(c) && /\.join\(/.test(c)) return true;
  if (/^[a-zA-Z_$][\w$]*\(.*\)$/.test(c) && /^(render|.*(Markup|Html|HTML|Card|Row|Tile|Badge|Icon|Options|Buttons|Section|Block|Panel|List|Grid|View)\w*)\(/.test(c)) return true; // helpers que devolvem HTML já escapado
  return false;
}
function splitPlus(c) { // divide concatenação 'a'+esc(b)+'c' no nível superior (sem confundir com soma numérica)
  let d = 0, last = 0; const parts = [];
  for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    if (ch === "'" || ch === '"') { i = skipString(c, i, ch); continue; }
    if (ch === '`') { i = scanTemplate(c, i).end; continue; }
    if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--;
    else if (d === 0 && ch === '+' && c[i + 1] !== '+' && c[i - 1] !== '+') { parts.push(c.slice(last, i)); last = i + 1; }
    else if (d === 0 && (ch === '?' || ch === ':' || (ch === '&' && c[i+1]==='&') || (ch === '|' && c[i+1]==='|'))) return null;
  }
  parts.push(c.slice(last));
  return parts;
}
function closesAtEnd(c) { // "esc(x) + y" não é seguro: confere que o parêntese inicial fecha no fim
  let d = 0, started = false;
  for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    if (ch === "'" || ch === '"') { i = skipString(c, i, ch); continue; }
    if (ch === '`') { i = scanTemplate(c, i).end; continue; }
    if (ch === '(') { d++; started = true; } else if (ch === ')') { d--; if (started && d === 0 && i < c.length - 1) return false; }
  }
  return true;
}
// divide "a ? b : c", "a && b", "a || b" no nível superior; devolve os ramos que produzem valor
function splitTop(c) {
  let d = 0; const q = [];
  for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    if (ch === "'" || ch === '"') { i = skipString(c, i, ch); continue; }
    if (ch === '`') { i = scanTemplate(c, i).end; continue; }
    if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--;
    else if (d === 0) {
      if (ch === '?' && c[i + 1] !== '.' && c[i + 1] !== '?') q.push(['?', i]);
      else if (ch === ':' ) q.push([':', i]);
      else if ((ch === '&' && c[i + 1] === '&') || (ch === '|' && c[i + 1] === '|')) { q.push([ch + ch, i]); i++; }
    }
  }
  if (!q.length) return null;
  if (q.some(([k]) => k === '?')) {
    const qi = q.find(([k]) => k === '?')[1];
    const ci = q.filter(([k]) => k === ':').pop()?.[1];
    if (ci == null) return null;
    return [c.slice(qi + 1, ci), c.slice(ci + 1)];
  }
  const cut = q[q.length - 1][1];
  return [c.slice(cut + 2)]; // em "a && b" / "a || b" só o último ramo pode ser renderizado
}

const findings = [];
let templates = 0, htmlTemplates = 0, interpolations = 0;
(function walk() {
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === "'" || c === '"') { i = skipString(src, i, c); continue; }
    if (c === '`') {
      const t = scanTemplate(src, i); templates++;
      if (/<[a-zA-Z\/]/.test(t.text)) {
        htmlTemplates++;
        for (const e of t.exprs) {
          interpolations++;
          if (!isSafeExpr(e.code)) findings.push({ line: lineOf(t.start + 1 + e.pos - t.start), code: e.code.trim().slice(0, 140), ctx: e.textBefore.slice(-40).replace(/\s+/g, ' ') });
        }
      }
      // percorre também os templates aninhados dentro das expressões
      for (const e of t.exprs) {
        const inner = e.code;
        for (let j = 0; j < inner.length; j++) {
          if (inner[j] === '`') {
            const it = scanTemplate(inner, j); templates++;
            if (/<[a-zA-Z\/]/.test(it.text)) {
              htmlTemplates++;
              for (const ie of it.exprs) { interpolations++; if (!isSafeExpr(ie.code)) findings.push({ line: lineOf(t.start), code: ie.code.trim().slice(0, 140), ctx: ie.textBefore.slice(-40).replace(/\s+/g, ' ') }); }
            }
            j = it.end;
          }
        }
      }
      i = t.end;
    }
  }
})();

import { existsSync, writeFileSync } from 'node:fs';
const BASE = 'scripts/xss-baseline.json';
const sig = f => `${f.code}  |  ${f.ctx}`;
if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASE, JSON.stringify([...new Set(findings.map(sig))].sort(), null, 1) + '\n');
  console.log(`Baseline salva: ${new Set(findings.map(sig)).size} padrões revisados.`);
  process.exit(0);
}
if (process.argv.includes('--check')) {
  const known = new Set(existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : []);
  const fresh = findings.filter(f => !known.has(sig(f)));
  console.log(`XSS audit: ${findings.length} interpolações não escapadas conhecidas, ${fresh.length} novas.`);
  for (const f of fresh) console.log(`NOVA  L${f.line}  \${${f.code}}   …${f.ctx}`);
  process.exit(fresh.length ? 1 : 0);
}
console.log(`Templates: ${templates} | com HTML: ${htmlTemplates} | interpolações: ${interpolations} | não escapadas: ${findings.length}`);
for (const f of findings) console.log(`L${f.line}  \${${f.code}}   …${f.ctx}`);
if (process.argv.includes('--strict') && findings.length) process.exit(1);
