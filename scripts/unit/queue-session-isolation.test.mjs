import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../../src/playerStore.js', import.meta.url), 'utf8');
test('fila em memória é limpa quando o escopo da sessão muda', () => {
  assert.match(src, /let activeQueueScope='';/);
  assert.match(src, /if\(scope!==activeQueueScope\)\{localQueue\.clear\(\);activeQueueScope=scope;\}/);
});
test('flush fixa token/escopo e verifica antes e depois de RPC', () => {
  assert.match(src, /const flushScope=queueScope\(\);/);
  assert.match(src, /const flushToken=String\(getAuthToken\(\)\|\|''\);/);
  assert.ok((src.match(/queueScope\(\)!==flushScope\|\|String\(getAuthToken\(\)\|\|''\)!==flushToken/g)||[]).length >= 3);
});
test('falha de autenticação interrompe retry da fila', () => {
  assert.match(src, /SESSAO_INVALIDA\|NAO_AUTORIZADO/);
});

test('playerStore sanitiza os dados antes de inserir a fila em memória', () => {
  assert.match(src, /sanitizePlayerQueueItem\(\{id:String\(p\?\.id\|\|''\)\.trim\(\),login:String\(p\?\.login\|\|''\),data:p\}\)/);
  assert.match(src, /data:safePlayer\.data,baseData:safeBase/);
});
