import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../../supabase/functions/upload-asset/index.ts', import.meta.url), 'utf8');

function extract(src, startMarker) {
  const i = src.indexOf(startMarker);
  assert.ok(i >= 0, `não achei ${startMarker}`);
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error('chaves não fecham');
}

test('upload-asset: Mestre pode gravar em players/<id>/ e Player só no próprio caminho', () => {
  const ts = extract(edge, 'function allowedPath').replace(/\(path: string, role: string, playerId: string \| null\)/, '(path, role, playerId)');
  const allowedPath = new Function(`${ts}; return allowedPath;`)();
  assert.equal(allowedPath('players/abc/portrait.webp', 'master', null), true);
  assert.equal(allowedPath('players/abc/wallpaper.jpg', 'master', null), true);
  assert.equal(allowedPath('players/abc/portrait.webp', 'player', 'abc'), true);
  assert.equal(allowedPath('players/outro/portrait.webp', 'player', 'abc'), false);
  assert.equal(allowedPath('players/../tv/x.webp', 'master', null), false);
  assert.equal(allowedPath('segredo/x.webp', 'master', null), false);
});

test('fotos aceitam imagens grandes de celular (limite de 40 MB, já que são reduzidas no navegador)', () => {
  assert.match(app, /const IMAGE_PICK_MAX_BYTES=40\*1024\*1024/);
  assert.doesNotMatch(app, /f\.size>5\*1024\*1024/);
  assert.doesNotMatch(app, /maior que 5 MB/);
});

function loadRemote({ upload, blobFn, dataFn, remoteEnabled = true }) {
  const src = extract(app, 'async function imageFileToRemoteURL');
  const warns = [];
  const fn = new Function('remoteEnabled', 'isSupportedImageFile', 'imageFileToBlob', 'imageFileToDataURL', 'uploadGlobalFile', 'File', 'console',
    `${src}; return imageFileToRemoteURL;`)(
    remoteEnabled, f => !!f, blobFn, dataFn, upload,
    class { constructor(parts, name, opts) { this.parts = parts; this.name = name; this.type = opts.type; } },
    { warn: (...a) => warns.push(a) },
  );
  return { fn, warns };
}

test('foto do Player: se o envio falhar ou voltar vazio, guarda cópia compacta em vez de apagar a foto', async () => {
  const blobFn = async () => ({ blob: { type: 'image/webp' }, ext: 'webp' });
  const dataFn = async (_f, size) => `data:image/webp;base64,AAAA#${size}`;
  const a = loadRemote({ upload: async () => '', blobFn, dataFn });
  assert.match(await a.fn({}, 'players/1/portrait.webp', 900, .8), /^data:image\/webp/);
  const b = loadRemote({ upload: async () => { throw new Error('forbidden'); }, blobFn, dataFn });
  assert.match(await b.fn({}, 'players/1/soul.webp', 1600, .8), /#720$/);
  assert.equal(b.warns.length, 1);
});

test('foto do Player: envio bem-sucedido devolve a URL e usa a extensão real do arquivo gerado', async () => {
  let sent;
  const blobFn = async () => ({ blob: { type: 'image/jpeg' }, ext: 'jpg' });
  const { fn } = loadRemote({ upload: async (path, file) => { sent = { path, file }; return `https://x/${path}`; }, blobFn, dataFn: async () => 'data:' });
  const url = await fn({}, 'players/7/portrait.webp', 900, .8);
  assert.equal(url, 'https://x/players/7/portrait.jpg');
  assert.equal(sent.file.type, 'image/jpeg');
});

test('imagens fora de players/ continuam falhando de forma explícita (sem cópia silenciosa)', async () => {
  const { fn } = loadRemote({ upload: async () => { throw new Error('forbidden'); }, blobFn: async () => ({ blob: { type: 'image/webp' }, ext: 'webp' }), dataFn: async () => 'data:' });
  await assert.rejects(() => fn({}, 'spells/1.webp', 900, .8), /forbidden/);
});
