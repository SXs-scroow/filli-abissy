// Carrega o playerStore.js REAL fora do Vite: copia src/*.js para .chaos-build/,
// troca import.meta.env (só existe no Vite) e aponta o Supabase para o proxy de teste.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, '.chaos-build');

export async function loadRealStore(supabaseUrl) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'supabaseConfig.js'),
    `export const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};\nexport const SUPABASE_PUBLISHABLE_KEY = 'chaos-test-key';\n`);
  const sync = readFileSync(resolve(root, 'src/globalSync.js'), 'utf8').replaceAll('import.meta.env', '({})');
  writeFileSync(resolve(out, 'globalSync.js'), sync);
  writeFileSync(resolve(out, 'playerStore.js'), readFileSync(resolve(root, 'src/playerStore.js'), 'utf8'));
  const store = await import(pathToFileURL(resolve(out, 'playerStore.js')).href);
  const gs = await import(pathToFileURL(resolve(out, 'globalSync.js')).href);
  return { store, gs };
}
export const cleanupBuild = () => rmSync(out, { recursive: true, force: true });
