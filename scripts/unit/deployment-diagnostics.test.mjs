import test from 'node:test';
import assert from 'node:assert/strict';
import { runDeploymentCacheCheck } from '../../src/version/deploymentDiagnostics.js';

const html = '<!doctype html><html><head><title>Ashen Testimony</title></head><body><script type="module" src="/assets/main-abc123.js"></script></body></html>';
const response = ({ status = 200, cacheControl = 'no-store, no-cache, must-revalidate' } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => name.toLowerCase() === 'cache-control' ? cacheControl : null },
  text: async () => html,
});

const base = {
  locationObj: { origin: 'https://ashen.example' },
  buildInfo: { release: 'V1.5.50', buildId: 'deploy-test-123' },
  serviceWorkerController: null,
};

test('deployment diagnostics passes for a fresh HTML shell and no-store headers', async () => {
  let requested;
  const report = await runDeploymentCacheCheck({ ...base, fetchImpl: async (url, options) => { requested = { url, options }; return response(); } });
  assert.equal(report.ok, true);
  assert.equal(report.buildId, 'deploy-test-123');
  assert.equal(requested.url, 'https://ashen.example/');
  assert.equal(requested.options.cache, 'no-store');
  assert.equal(requested.options.headers.Pragma, 'no-cache');
});

test('deployment diagnostics flags cache headers that can retain stale HTML', async () => {
  const report = await runDeploymentCacheCheck({ ...base, fetchImpl: async () => response({ cacheControl: 'public, max-age=3600' }) });
  assert.equal(report.ok, false);
  assert.ok(report.checks.some((c) => c.name.includes('cache') && !c.ok));
});

test('deployment diagnostics flags a controlling service worker', async () => {
  const report = await runDeploymentCacheCheck({ ...base, serviceWorkerController: { scriptURL: '/sw.js' }, fetchImpl: async () => response() });
  assert.equal(report.ok, false);
  assert.ok(report.checks.some((c) => c.name.includes('Service worker') && !c.ok));
});

test('deployment diagnostics reports fetch failures without throwing', async () => {
  const report = await runDeploymentCacheCheck({ ...base, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(report.ok, false);
  assert.ok(report.checks.some((c) => c.detail === 'offline'));
});
