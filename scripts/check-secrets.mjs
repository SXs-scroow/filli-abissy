// Procura segredos comuns ANTES do push (o GitHub bloqueia pushes com segredos: erro GH013).
// Uso: npm run check:secrets
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.vercel', '.chaos-build']);
const TEXT_EXT = /\.(js|mjs|cjs|ts|json|html|css|md|sql|toml|yml|yaml|txt|env|sh)$/i;
const RULES = [
  ['Supabase secret/service key', /sb_secret_[A-Za-z0-9_-]{10,}/],
  ['JWT (possível service_role/anon antiga)', /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['GitHub token', /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
  ['Chave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{30,}/],
  ['Slack/Discord webhook', /hooks\.slack\.com\/services\/|discord(app)?\.com\/api\/webhooks\//],
  ['Chave sk- (OpenAI/Stripe/Anthropic)', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['String de conexão com senha', /(postgres(ql)?|mongodb(\+srv)?|mysql):\/\/[^\s:@]+:[^\s@]+@/],
  ['Token npm/Vercel', /npm_[A-Za-z0-9]{30,}|vercel_[A-Za-z0-9]{20,}/],
  ['Spotify client secret', /SPOTIFY_CLIENT_SECRET\s*[:=]\s*['"][^'"]{8,}['"]/],
];
const found = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
    const f = path.join(dir, e.name), rel = path.relative(root, f);
    if (/^\.env(\..*)?$/.test(e.name) && !/\.example$/.test(e.name)) { found.push([rel, 0, 'Arquivo .env (não deve ir para o GitHub)']); continue; }
    if (!TEXT_EXT.test(e.name) || fs.statSync(f).size > 2_000_000) continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const [name, re] of RULES) if (re.test(line)) found.push([rel, i + 1, name]);
    });
  }
})(root);
if (found.length) {
  console.error('Possíveis segredos encontrados:');
  for (const [f, l, n] of found) console.error(`  ${f}${l ? ':' + l : ''}  →  ${n}`);
  console.error('\nRemova/rotacione o segredo antes de dar push. A chave "sb_publishable_" do Supabase é pública por design e não é reportada.');
  process.exit(1);
}
console.log('Secret check OK: nenhum segredo conhecido encontrado.');
