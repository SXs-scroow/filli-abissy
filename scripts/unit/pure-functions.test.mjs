// Testes que EXECUTAM funções reais do app.js (extraídas), sem procurar texto no código.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractFunction } from '../chaos/extract-app.mjs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const names = ['esc', 'safeHref', 'safeImgSrc', 'spotifyResource', 'isSpotifyShortLink'];
// Funções de uma linha só (com regex cheia de aspas) são extraídas por linha; as demais pelo delimitador de chaves.
function grab(name) {
  const line = src.split('\n').find(l => l.startsWith(`function ${name}(`) && l.trimEnd().endsWith('}'));
  return line ?? extractFunction(src, name);
}
const ctx = vm.createContext({ URL, String, RegExp });
vm.runInContext(names.map(grab).join('\n') +
  '\nglobalThis.api={esc,safeHref,safeImgSrc,spotifyResource,isSpotifyShortLink};', ctx);
const { esc, safeHref, safeImgSrc, spotifyResource, isSpotifyShortLink } = ctx.api;

test('esc neutraliza HTML e aspas de atributo', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(esc('" onmouseover="x'), '&quot; onmouseover=&quot;x');
  assert.equal(esc("' onfocus='x"), '&#39; onfocus=&#39;x');
  assert.equal(esc('a&b'), 'a&amp;b');
  assert.equal(esc(undefined), '');
  assert.equal(esc(null), 'null'); // documenta o comportamento atual
  assert.equal(esc(42), '42');
});

test('esc: nenhum caractere perigoso sobra na saída', () => {
  const out = esc(`<img src=x onerror="alert('x')">&`);
  assert.doesNotMatch(out, /[<>"']/);
});

test('safeImgSrc bloqueia esquemas perigosos', () => {
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml;base64,PHN2Zz4=', 'vbscript:x', '/x"onerror="y', '/a b']) {
    assert.equal(safeImgSrc(bad, 'FALLBACK'), 'FALLBACK', `deveria bloquear: ${bad}`);
  }
});

test('safeImgSrc nunca devolve URL protocolo-relativa (//host) que apontaria para outro domínio', () => {
  const out = safeImgSrc('//evil.com/x.png', 'F');
  assert.ok(!out.startsWith('//'), `saída perigosa: ${out}`);
  assert.equal(out, '/evil.com/x.png'); // vira caminho do próprio site
});

test('safeImgSrc aceita fontes legítimas', () => {
  assert.equal(safeImgSrc('https://x.supabase.co/a.png'), 'https://x.supabase.co/a.png');
  assert.equal(safeImgSrc('/runa-gold.png'), '/runa-gold.png');
  assert.equal(safeImgSrc('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(safeImgSrc('blob:https://x/abc'), 'blob:https://x/abc');
  assert.equal(safeImgSrc('', 'F'), 'F');
  assert.equal(safeImgSrc(null, 'F'), 'F');
});

test('spotifyResource entende links, URIs e rejeita o resto', () => {
  assert.deepEqual({ ...spotifyResource('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc') },
    { type: 'track', id: '4uLU6hMCjMI75M1A2tKUQC', uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC' });
  assert.equal(spotifyResource('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M').type, 'playlist');
  assert.equal(spotifyResource('https://open.spotify.com/intl-pt/album/abc123').type, 'album');
  for (const bad of ['https://evil.com/track/abc', 'https://open.spotify.com/track/', 'https://open.spotify.com/track/a<b',
    'not a url', '', null, 'spotify:track:', 'https://open.spotify.com.evil.com/track/abc']) {
    assert.equal(spotifyResource(bad), null, `deveria rejeitar: ${bad}`);
  }
});

test('isSpotifyShortLink só aceita os domínios de link curto', () => {
  assert.ok(isSpotifyShortLink('https://spotify.link/abc'));
  assert.ok(isSpotifyShortLink('https://spoti.fi/abc'));
  assert.ok(isSpotifyShortLink('https://open.spotify.com/s/abc'));
  assert.ok(!isSpotifyShortLink('https://open.spotify.com/track/abc'));
  assert.ok(!isSpotifyShortLink('https://evil.com/spotify.link/'));
});

test('safeHref só deixa passar http(s) e mailto', () => {
  assert.equal(safeHref('https://a.com/x'), 'https://a.com/x');
  assert.equal(safeHref('mailto:a@b.com'), 'mailto:a@b.com');
  for (const bad of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.com', '']) {
    assert.equal(safeHref(bad), '#', `deveria bloquear: ${bad}`);
  }
});
