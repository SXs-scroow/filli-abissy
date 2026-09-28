import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

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
  assert.equal(sent.max_completion_tokens, 4000);
  assert.equal(sent.max_tokens, undefined);
  assert.equal(sent.temperature, undefined, 'gpt-5* rejeita temperature diferente do padrão');

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

  // Anthropic direto
  process.env.AI_GATEWAY_API_KEY = '';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  globalThis.fetch = async (url, options = {}) => {
    if (url.includes('/rest/v1/rpc/a_profecia_whoami')) {
      return new Response(JSON.stringify({ role: 'master' }), { status: 200 });
    }
    providerRequest = { url, options };
    return new Response(JSON.stringify({ model: 'claude-sonnet-5', content: [{ type: 'text', text: 'ok-claude' }] }), { status: 200 });
  };
  const outputClaude = { status: 0, body: null, status(code) { this.status = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer session-token' },
    body: { messages: [{ role: 'assistant', content: 'sobra' }, { role: 'user', content: 'teste claude' }] }
  }, outputClaude);
  assert.equal(outputClaude.status, 200);
  assert.equal(outputClaude.body.message, 'ok-claude');
  assert.equal(providerRequest.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(providerRequest.options.headers['x-api-key'], 'test-anthropic-key');
  assert.equal(JSON.parse(providerRequest.options.body).messages[0].role, 'user');

  // Chave personalizada 'filiabissy' com detecção por prefixo
  process.env.ANTHROPIC_API_KEY = '';
  for (const [key, expected] of [['vck_abc', 'https://ai-gateway.vercel.sh/v1/chat/completions'], ['sk-ant-abc', 'https://api.anthropic.com/v1/messages'], ['sk-abc', 'https://api.openai.com/v1/chat/completions']]) {
    process.env.filiabissy = key;
    providerRequest = null;
    globalThis.fetch = async (url, options = {}) => {
      if (url.includes('/rest/v1/rpc/a_profecia_whoami')) return new Response(JSON.stringify({ role: 'master' }), { status: 200 });
      providerRequest = { url, options };
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], content: [{ type: 'text', text: 'ok' }] }), { status: 200 });
    };
    const o = { status: 0, body: null, status(c) { this.status = c; return this; }, json(v) { this.body = v; return this; } };
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { messages: [{ role: 'user', content: 'x' }] } }, o);
    assert.equal(o.status, 200);
    assert.equal(providerRequest.url, expected);
  }
  delete process.env.filiabissy;

  console.log('maintenance-ai: PASS');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
  if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
}
