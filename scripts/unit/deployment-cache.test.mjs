import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('entry point does not use a manually pinned cache-busting query', () => {
  const html = read('index.html');
  const main = read('src/main.js');
  assert.match(html, /src="\/src\/main\.js"/);
  assert.doesNotMatch(html, /main\.js\?v=/);
  assert.match(main, /import ['"]\.\.\/app\.js['"]/);
  assert.doesNotMatch(main, /app\.js\?build=/);
});

test('Vercel revalidates the HTML shell and the build exposes a deployment ID', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const rootRule = vercel.headers.find((rule) => rule.source === '/');
  const htmlRule = vercel.headers.find((rule) => rule.source === '/index.html');
  assert.match(rootRule.headers.find((h) => h.key === 'Cache-Control').value, /no-store/);
  assert.match(htmlRule.headers.find((h) => h.key === 'Cache-Control').value, /no-store/);
  assert.match(read('vite.config.js'), /VERCEL_DEPLOYMENT_ID/);
  assert.match(read('src/version/buildInfo.js'), /__ASHEN_BUILD_ID__/);
});

test('master test lab exposes a read-only deployment cache diagnostic', () => {
  const lab = read('src/loadTest.js');
  const app = read('app.js');
  const diagnostic = read('src/version/deploymentDiagnostics.js');
  assert.match(lab, /runDeploymentCacheCheck/);
  assert.match(lab, /runDeploymentCacheCheck/);
  assert.match(lab, /id=\"runDeploymentCacheCheck\"/);
  assert.match(app, /runDeploymentCacheSelfTest/);
  assert.match(diagnostic, /cache: 'no-store'/);
  assert.match(diagnostic, /serviceWorkerController/);
});


test('loadAdmin exposes local performance diagnostics without removing previous test stages', async () => {
  const { loadAdmin } = await import('../../src/loadTest.js');
  const html = loadAdmin('V1.5.52');
  assert.match(html, /Desempenho local, memória e carregamento/);
  assert.match(html, /runPerformanceDiagnostics/);
  assert.match(html, /exportPerformanceReport/);
  assert.match(html, /runPersistenceSelfTest/);
  assert.match(html, /runPlayerStressTest/);
  assert.match(html, /runDeploymentCacheCheck/);
});
