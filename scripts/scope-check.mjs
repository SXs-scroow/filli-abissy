// Detecta identificadores indefinidos / fora de escopo (ex.: const declarado dentro de um if e usado depois).
// Usa o compilador do TypeScript só como analisador estático; não altera nenhum arquivo.
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const candidates = [
  resolve('node_modules/typescript/bin/tsc'),
  ...(process.env.TSC ? [process.env.TSC] : []),
  '/home/claude/.npm-global/lib/node_modules/typescript/bin/tsc'
];
const tsc = candidates.find(existsSync);
if (!tsc) { console.log('scope-check: typescript não encontrado (npm i -D typescript) — pulando.'); process.exit(0); }

const dir = mkdtempSync(join(tmpdir(), 'scope-'));
const cfg = join(dir, 'tsconfig.json');
writeFileSync(cfg, JSON.stringify({
  compilerOptions: { allowJs: true, checkJs: true, noEmit: true, target: 'es2022', module: 'esnext', moduleResolution: 'bundler',
    lib: ['es2022', 'dom', 'dom.iterable'], skipLibCheck: true, strict: false, types: [], maxNodeModuleJsDepth: 0 },
  files: [resolve('app.js'), ...['src/globalSync.js','src/playerStore.js','src/supabaseConfig.js','src/main.js'].map(f => resolve(f)).filter(existsSync)]
}));
const r = spawnSync('node', [tsc, '-p', cfg], { encoding: 'utf8' });
// TS2304 = não encontrou o nome | TS2448/TS2454 = usado antes de declarar/atribuir
const bad = (r.stdout || '').split('\n').filter(l => /error TS(2304|2448|2454):/.test(l));
if (bad.length) { console.error(`scope-check FALHOU: ${bad.length} identificador(es) fora de escopo:`); bad.forEach(l => console.error('  ' + l.replace(resolve('.') + '/', ''))); process.exit(1); }
console.log('scope-check OK: nenhum identificador fora de escopo.');
