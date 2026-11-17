import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fn = readFileSync(new URL('../../supabase/functions/upload-asset/index.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../../src/globalSync.js', import.meta.url), 'utf8');

test('o CORS libera todos os cabeçalhos que o site envia no envio direto', () => {
  const sent = [...client.matchAll(/'(x-asset-[a-z-]+)'/g)].map(m => m[1]);
  assert.ok(sent.includes('x-asset-mode') && sent.includes('x-asset-size'));
  const allow = fn.match(/Access-Control-Allow-Headers\": \"([^"]+)\"/)[1];
  for (const h of new Set(sent)) assert.ok(allow.includes(h), `CORS não libera ${h}`);
});

test('o Mestre pode gravar em todas as pastas que o site usa', () => {
  const folders = new Set([...fetchPaths()]);
  const allowed = fn.match(/\^\(([^)]+)\)\\\//)[1].split('|');
  for (const f of folders) assert.ok(allowed.includes(f), `pasta sem permissão: ${f}`);
});

function* fetchPaths() {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  for (const m of app.matchAll(/(?:uploadGlobalFile|imageFileToRemoteURL)\(\s*[`'"]([a-z-]+)\//g)) yield m[1];
}

test('PDF só é aceito na pasta rules/ e o erro de formato não fala só de vídeo', () => {
  assert.match(fn, /ext === "pdf" && path\.startsWith\("rules\/"\)/);
  assert.doesNotMatch(client, /unsupported_file_type: 'Formato não suportado\. Use MP4/);
});
