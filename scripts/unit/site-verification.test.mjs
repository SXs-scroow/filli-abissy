import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runSiteVerification, buildChecks, formatVerificationReport, expectedPool } from '../../src/siteVerification.js';

const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
function extract(startMarker) {
  const i = app.indexOf(startMarker); assert.ok(i >= 0, startMarker);
  let depth = 0, j = app.indexOf('){', i) + 1;
  for (let k = j; k < app.length; k++) { if (app[k] === '{') depth++; else if (app[k] === '}' && --depth === 0) return app.slice(i, k + 1); }
  throw new Error('chaves');
}
// motor REAL do app.js (mesmo código do navegador)
function realRollApi({ breakBonus = false } = {}) {
  let src = ['let rollAdvMode="";', extract('function rollOneD20'), extract('function rollPoolLimit'), extract('function rollGrade'),
    'return {pool:(p,a)=>{rollAdvMode=a;return rollPoolLimit(p)},grade:rollGrade};'].join('\n');
  if (breakBonus) src = src.replace('Math.max(0,pts-3)*2', 'Math.max(0,pts-3)*1');
  const api = new Function('crypto', 'window', src)(globalThis.crypto, globalThis);
  return { mode: () => 'limit', pool: api.pool, grade: api.grade, skills: () => ['Investigação'], attrs: () => ['Corpo'], skillPoints: (p, s) => p.skills[s] || 0, attrPoints: (p, a) => p.attrs[a] || 0 };
}
const goodPlayers = [{ name: 'A', skills: { Investigação: 5 }, attrs: { Corpo: 3 } }];
const base = (over = {}) => ({ version: 't', role: 'player', env: { location: { origin: 'https://x', pathname: '/' } }, state: { players: goodPlayers }, rollApi: realRollApi(), ...over });
const only = (rep, id) => rep.results.find(r => r.id === id);

test('tabela de pontos: 1→1d, 3→3d, 6→3d+6, vantagem/desvantagem com limites', () => {
  assert.deepEqual(expectedPool(0, ''), { count: 1, bonus: 0 });
  assert.deepEqual(expectedPool(5, ''), { count: 3, bonus: 4 });
  assert.deepEqual(expectedPool(6, 'dis'), { count: 2, bonus: 6 });
  assert.deepEqual(expectedPool(1, 'dis'), { count: 1, bonus: 0 });
  assert.deepEqual(expectedPool(3, 'adv'), { count: 3, bonus: 0 });
});

test('o motor REAL de rolagem do app.js passa em todas as verificações de rolagem', async () => {
  const rep = await runSiteVerification(base());
  for (const id of ['roll-mode', 'roll-pool', 'roll-random', 'roll-grade', 'roll-real-data']) assert.equal(only(rep, id).status, 'ok', `${id}: ${only(rep, id).detail}`);
});

test('um motor de rolagem com bônus errado é REPROVADO (a verificação não passa de mentira)', async () => {
  const rep = await runSiteVerification(base({ rollApi: realRollApi({ breakBonus: true }) }));
  assert.equal(only(rep, 'roll-pool').status, 'fail');
  assert.match(only(rep, 'roll-pool').fix, /rollPoolLimit/);
  assert.equal(rep.verdict, 'failed');
});

test('ficha real com perícia inválida (NaN) é apontada pelo nome', async () => {
  const api = realRollApi(); api.skillPoints = () => NaN;
  const rep = await runSiteVerification(base({ rollApi: api }));
  assert.equal(only(rep, 'roll-real-data').status, 'fail');
  assert.match(only(rep, 'roll-real-data').evidence[0], /A: perícia/);
});

test('servidor fora do ar, tabela ausente e rota ausente viram FALHA com instrução', async () => {
  const fetchMock = async u => {
    if (u.includes('/rest/v1/a_profecia_session_puzzles')) return { status: 404, headers: new Map() };
    if (u.includes('/api/')) return { status: 200, headers: { get: () => 'text/html' }, text: async () => '<html>' };
    throw new Error('Failed to fetch');
  };
  const rep = await runSiteVerification(base({ role: 'master', supabaseUrl: 'https://s.supabase.co', supabaseKey: 'k', remoteEnabled: true, env: { location: { origin: 'https://x', pathname: '/' }, fetch: fetchMock } }));
  assert.equal(only(rep, 'srv-reach').status, 'fail');
  assert.match(only(rep, 'srv-reach').detail, /Failed to fetch/);
  const t = only(rep, 'db-a_profecia_session_puzzles');
  assert.equal(t.status, 'fail'); assert.match(t.fix, /20261014120000_session_puzzles\.sql/);
  assert.equal(only(rep, 'api-/api/ashen-ai').status, 'fail');
  assert.equal(rep.verdict, 'failed');
  const txt = formatVerificationReport(rep);
  assert.match(txt, /O QUE PRECISA SER RESOLVIDO/); assert.match(txt, /COMO CORRIGIR/);
});

test('tempo esgotado vira falha (não trava nem passa)', async () => {
  const deps = base({ role: 'master', remoteEnabled: true, supabaseUrl: 'u', supabaseKey: 'k', getAuthToken: () => 't', authCheck: () => new Promise(() => {}) });
  const orig = buildChecks(deps).find(c => c.id === 'srv-auth'); assert.ok(orig);
  deps.__fast = true;
  const rep = await Promise.race([runSiteVerification({ ...deps, env: { ...deps.env, fetch: async () => ({ status: 200, headers: new Map(), text: async () => '' }) } }), new Promise((_, r) => setTimeout(() => r(new Error('travou')), 60000))]);
  assert.equal(only(rep, 'srv-auth').status, 'fail');
  assert.match(only(rep, 'srv-auth').detail, /tempo esgotado/);
});

test('verificações que não rodaram NUNCA resultam em APROVADO', async () => {
  const rep = await runSiteVerification(base());
  assert.ok(rep.counts.skip > 0);
  assert.notEqual(rep.verdict, 'passed');
});

test('sem WebRTC o teste de loopback falha com instrução', async () => {
  const rep = await runSiteVerification(base());
  assert.equal(only(rep, 'nx-loopback').status, 'fail');
  assert.ok(only(rep, 'nx-loopback').fix);
});


test('ambiente Vite em IP local não reprova HTTPS, captura de tela ou rotas Vercel', async () => {
  const fetchMock = async () => ({ status: 404, headers: { get: () => 'text/html' }, text: async () => '<html>Not Found</html>' });
  const rep = await runSiteVerification(base({
    role: 'master',
    env: {
      location: { origin: 'http://192.168.1.136:5173', hostname: '192.168.1.136', protocol: 'http:', pathname: '/' },
      isSecureContext: false,
      navigator: { mediaDevices: {} },
      fetch: fetchMock
    }
  }));
  assert.equal(only(rep, 'env-secure').status, 'skip');
  assert.equal(only(rep, 'nx-display').status, 'skip');
  for (const route of ['/api/ashen-ai', '/api/maintenance-ai', '/api/resolve-spotify']) {
    assert.equal(only(rep, `api-${route}`).status, 'skip');
  }
});
