import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

test('auditoria XSS termina no app.js real e não introduz findings fora da baseline', () => {
  const result = spawnSync(process.execPath, ['scripts/xss-audit.mjs', '--check'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(result.error, undefined, `auditoria falhou ou excedeu o limite: ${result.error?.message || ''}\n${result.stderr || ''}`);
  assert.equal(result.status, 0, `auditoria retornou ${result.status}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /0 novas\./, result.stdout);
});
