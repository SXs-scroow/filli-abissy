import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/maintenanceAgent.js', import.meta.url), 'utf8');

test('agente de manutenção não faz polling agressivo e verifica ao voltar à aba', () => {
  assert.match(source, /setInterval\(ensure,10000\)/);
  assert.match(source, /visibilitychange.*ensure\(\)/s);
  assert.doesNotMatch(source, /setInterval\(ensure,\s*(?:500|1000|2000)\)/);
});
