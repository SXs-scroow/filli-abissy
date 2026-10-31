// Carrega o playerStore.js REAL fora do Vite: copia src/*.js para .chaos-build/,
// troca import.meta.env (só existe no Vite) e aponta o Supabase para o proxy de teste.
import { mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, '.chaos-build');

export async function loadRealStore(supabaseUrl) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  mkdirSync(resolve(out, 'persistence'), { recursive: true });
  copyFileSync(resolve(root, 'src/persistence/browserStorage.js'), resolve(out, 'persistence/browserStorage.js'));
  copyFileSync(resolve(root, 'src/persistence/playerQueue.js'), resolve(out, 'persistence/playerQueue.js'));
  copyFileSync(resolve(root, 'src/persistence/concurrency.js'), resolve(out, 'persistence/concurrency.js'));
  writeFileSync(resolve(out, 'supabaseConfig.js'),
    `export const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};\nexport const SUPABASE_PUBLISHABLE_KEY = 'chaos-test-key';\n`);
  let sync = readFileSync(resolve(root, 'src/globalSync.js'), 'utf8').replaceAll('import.meta.env', '({})');
  // A suíte deve conseguir rodar também em ambientes isolados, sem npm install.
  // Quando o SDK real está instalado, ele continua sendo usado; o fallback abaixo
  // implementa apenas o transporte RPC necessário contra o servidor Supabase falso.
  try {
    await import.meta.resolve('@supabase/supabase-js');
  } catch {
    writeFileSync(resolve(out, 'supabase-test-client.js'), `
export function createClient(url, key) {
  const base = String(url).endsWith('/') ? String(url).slice(0, -1) : String(url);
  const makeChannel = () => {
    const channel = {
      on() { return channel; },
      subscribe(callback) { if (typeof callback === 'function') queueMicrotask(() => callback('SUBSCRIBED')); return channel; },
      track() { return Promise.resolve('ok'); },
      presenceState() { return {}; },
      send() { return Promise.resolve({ status: 'ok' }); }
    };
    return channel;
  };
  return {
    async rpc(name, args = {}) {
      let response;
      try {
        response = await fetch(base + '/rest/v1/rpc/' + encodeURIComponent(name), {
          method: 'POST',
          headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' },
          body: JSON.stringify(args)
        });
      } catch (cause) { return { data: null, error: { message: String(cause?.message || cause) } }; }
      let body = null;
      try { body = await response.json(); } catch (cause) { return { data: null, error: { status: response.status, message: String(cause?.message || cause || 'Resposta RPC inválida') } }; }
      return response.ok ? { data: body, error: null } : { data: null, error: { ...(body && typeof body === 'object' ? body : {}), status: response.status, message: body?.message || response.statusText || 'RPC failed' } };
    },
    channel: makeChannel,
    removeChannel() { return Promise.resolve('ok'); },
    storage: { from(bucket) { return { getPublicUrl(path) { return { data: { publicUrl: base + '/storage/v1/object/public/' + bucket + '/' + path } }; } }; } },
    functions: { async invoke() { return { data: null, error: { message: 'Functions.invoke não está implementado no adaptador de teste' } }; } }
  };
}
`);
    sync = sync.replace("import { createClient } from '@supabase/supabase-js';", "import { createClient } from './supabase-test-client.js';");
  }
  writeFileSync(resolve(out, 'globalSync.js'), sync);
  writeFileSync(resolve(out, 'stampClock.js'), readFileSync(resolve(root, 'src/stampClock.js'), 'utf8'));
  writeFileSync(resolve(out, 'playerStore.js'), readFileSync(resolve(root, 'src/playerStore.js'), 'utf8'));
  const store = await import(pathToFileURL(resolve(out, 'playerStore.js')).href);
  const gs = await import(pathToFileURL(resolve(out, 'globalSync.js')).href);
  return { store, gs };
}
export const cleanupBuild = () => rmSync(out, { recursive: true, force: true });
