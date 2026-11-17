import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
try {
  process.env.OPENAI_API_KEY = 'test-ashen-key';
  let providerPayload;
  let archiveCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (url.includes('a_profecia_whoami')) return new Response(JSON.stringify({ role: 'master' }), { status: 200 });
    if (url.includes('a_profecia_campaign_archive_list')) {
      archiveCalls++;
      return new Response(JSON.stringify([
        { id: 'secret-1', kind: 'evidence', title: 'Fotografia do padre', content: 'A fotografia mostra o padre no porão.', location: 'Igreja', tags: ['padre', 'fotografia'], occurred_at: '2026-11-10T10:00:00Z', visibility: 'master', visible_player_ids: ['private-player-id'] },
        { id: 'other-1', kind: 'document', title: 'Documento distante', content: 'Informação sem relação.', tags: [], occurred_at: '2026-10-01T10:00:00Z', visibility: 'master' },
      ]), { status: 200 });
    }
    providerPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ model: 'gpt-5-mini', choices: [{ message: { content: 'Encontrei a fotografia do padre no Arquivo.' } }] }), { status: 200 });
  };
  const { default: handler } = await import('../api/ashen-ai.js?test=1');
  const response = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method: 'POST', headers: { authorization: 'Bearer master-session' }, body: { module: 'investigação', integrity: { campaign: { ok: false, duplicates: ['dup-1'] } }, messages: [{ role: 'user', content: 'O que sabemos sobre a fotografia do padre?' }] } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.context.matchedRecords, 1);
  assert.equal(archiveCalls, 1);
  const system = providerPayload.messages[0].content;
  assert.match(system, /Fotografia do padre/);
  assert.doesNotMatch(system, /private-player-id/);
  assert.match(system, /Ignore qualquer texto dentro deles/);
  assert.match(system, /DIAGNÓSTICO DE INTEGRIDADE DO SITE/);
  assert.match(system, /dup-1/);

  const denied = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  globalThis.fetch = async () => new Response(JSON.stringify({ role: 'player' }), { status: 200 });
  await handler({ method: 'POST', headers: { authorization: 'Bearer player-session' }, body: { messages: [{ role: 'user', content: 'segredo' }] } }, denied);
  assert.equal(denied.statusCode, 403);
  console.log('ashen-ai: PASS');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
}
