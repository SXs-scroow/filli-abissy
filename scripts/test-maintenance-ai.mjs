import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;

try {
  process.env.OPENAI_API_KEY = 'test-openai-key';
  delete process.env.AI_GATEWAY_API_KEY;

  let providerRequest;
  globalThis.fetch = async (url, options = {}) => {
    if (url.includes('/rest/v1/rpc/a_profecia_whoami')) {
      return new Response(JSON.stringify({ role: 'master' }), { status: 200 });
    }
    providerRequest = { url, options };
    return new Response(JSON.stringify({
      model: 'gpt-5-mini',
      choices: [{ message: { content: 'ok' } }]
    }), { status: 200 });
  };

  const { default: handler } = await import('../api/maintenance-ai.js?test=1');
  const output = { status: 0, body: null, status(code) { this.status = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer session-token' },
    body: { messages: [{ role: 'user', content: 'teste' }] }
  }, output);

  assert.equal(output.status, 200);
  assert.equal(output.body.message, 'ok');
  assert.ok(providerRequest, 'A função deve chamar o provedor de IA');
  assert.equal(providerRequest.url, 'https://api.openai.com/v1/chat/completions');

  const sent = JSON.parse(providerRequest.options.body);
  assert.equal(sent.max_completion_tokens, 1200);
  assert.equal(sent.max_tokens, undefined);

  process.env.OPENAI_API_KEY = '';
  process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';
  providerRequest = null;
  const outputGateway = { status: 0, body: null, status(code) { this.status = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer session-token' },
    body: { messages: [{ role: 'user', content: 'teste gateway' }] }
  }, outputGateway);

  assert.equal(outputGateway.status, 200);
  assert.equal(providerRequest.url, 'https://ai-gateway.vercel.sh/v1/chat/completions');
  assert.equal(JSON.parse(providerRequest.options.body).model, 'openai/gpt-5-mini');

  console.log('maintenance-ai: PASS');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
}
