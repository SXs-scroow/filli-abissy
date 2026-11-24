import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const envKeys = ['OPENAI_API_KEY', 'AI_GATEWAY_API_KEY', 'ANTHROPIC_API_KEY', 'filiabissy'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
try {
  process.env.OPENAI_API_KEY = 'test-openai-key';
  for (const key of ['AI_GATEWAY_API_KEY', 'ANTHROPIC_API_KEY', 'filiabissy']) delete process.env[key];
  const { default: handler } = await import('../api/ashen-ai.js?test=integration');
  const makeResponse = () => ({ statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });
  const masterFetch = async (url) => {
    if (String(url).includes('/rest/v1/rpc/a_profecia_whoami')) return new Response(JSON.stringify({ role: 'master' }), { status: 200 });
    throw new Error(`Unexpected fetch: ${url}`);
  };

  // Provider tool call -> validated proposal, never executed on the server.
  let providerRequest;
  let proposalCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    const who = await (async () => String(url).includes('/rest/v1/rpc/a_profecia_whoami'))();
    if (who) return new Response(JSON.stringify({ role: 'master' }), { status: 200 });
    if (!providerRequest) providerRequest = { url, options };
    proposalCalls += 1;
    if (proposalCalls === 1) return new Response(JSON.stringify({ model: 'gpt-5-mini', choices: [{ message: {
      role: 'assistant', content: 'Preparei a alteração.', tool_calls: [{ id: 'call-change', type: 'function', function: {
        name: 'change_resource', arguments: JSON.stringify({ target: 'Engel', resource: 'hp', delta: -2 })
      } }]
    } }] }), { status: 200 });
    return new Response(JSON.stringify({ model: 'gpt-5-mini', choices: [{ message: { role: 'assistant', content: 'A proposta está pronta para confirmação.' } }] }), { status: 200 });
  };
  const proposal = makeResponse();
  await handler({ method: 'POST', headers: { authorization: 'Bearer session-token' }, body: {
    messages: [{ role: 'user', content: 'Tire 2 de vida de Engel' }],
    context: { players: [{ id: 'p1', name: 'Engel', hp: 10, hpMax: 12 }] }
  } }, proposal);
  assert.equal(proposal.statusCode, 200);
  assert.equal(proposal.body.action.type, 'change_resource');
  assert.equal(proposal.body.action.target, 'p1');
  assert.equal(proposal.body.action.delta, -2);
  assert.equal(providerRequest.url, 'https://api.openai.com/v1/chat/completions');
  const sent = JSON.parse(providerRequest.options.body);
  assert.match(sent.messages[0].content, /Você é Ashen/);
  assert.match(sent.messages[0].content, /MISSÃO E RACIOCÍNIO/);
  assert.ok(sent.tools.some(tool => tool.function.name === 'set_condition'));
  assert.ok(sent.tools.some(tool => tool.function.name === 'roll_skill_check'));

  // Multiple consequential operations are queued across model turns and never applied server-side.
  const multiRequests = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/rest/v1/rpc/a_profecia_whoami')) return new Response(JSON.stringify({ role: 'master' }), { status: 200 });
    const payload = JSON.parse(options.body || '{}');
    multiRequests.push(payload);
    const call = multiRequests.length === 1
      ? { id: 'call-condition', type: 'function', function: { name: 'set_condition', arguments: JSON.stringify({ target: 'Engel', condition: 'Sangramento' }) } }
      : multiRequests.length === 2
        ? { id: 'call-archive', type: 'function', function: { name: 'record_campaign_event', arguments: JSON.stringify({ kind: 'evidence', title: 'Marca no corredor', content: 'Uma marca recente foi encontrada no corredor.' }) } }
        : null;
    return new Response(JSON.stringify({ model: 'gpt-5-mini', choices: [{ message: call
      ? { role: 'assistant', content: null, tool_calls: [call] }
      : { role: 'assistant', content: 'Preparei as duas alterações para sua revisão.' }
    }] }), { status: 200 });
  };
  const multi = makeResponse();
  await handler({ method: 'POST', headers: { authorization: 'Bearer session-token' }, body: {
    messages: [{ role: 'user', content: 'Aplique Sangramento em Engel e registre a marca no Arquivo.' }],
    context: { players: [{ id: 'p1', name: 'Engel', conditions: [] }], conditionCatalog: [{ id: 'bleeding', name: 'Sangramento' }] }
  } }, multi);
  assert.equal(multi.statusCode, 200);
  assert.equal(multi.body.actions.length, 2);
  assert.deepEqual(multi.body.actions.map(action => action.type), ['set_condition', 'record_campaign_event']);
  assert.equal(multi.body.action.type, 'set_condition');
  assert.match(JSON.stringify(multiRequests[1].messages), /proposal_prepared/);

  // Read-only tool call -> server executes the dice and returns its actual result to the model.
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/rest/v1/rpc/a_profecia_whoami')) return new Response(JSON.stringify({ role: 'master' }), { status: 200 });
    requests.push({ url: String(url), body: JSON.parse(options.body || '{}') });
    if (requests.length === 1) return new Response(JSON.stringify({ model: 'gpt-5-mini', choices: [{ message: {
      role: 'assistant', content: null, tool_calls: [{ id: 'call-dice', type: 'function', function: {
        name: 'roll_dice', arguments: JSON.stringify({ expression: '1d20' })
      } }]
    } }] }), { status: 200 });
    return new Response(JSON.stringify({ model: 'gpt-5-mini', choices: [{ message: { content: 'O resultado da rolagem foi registrado: consultei o dado real.' } }] }), { status: 200 });
  };
  const dice = makeResponse();
  await handler({ method: 'POST', headers: { authorization: 'Bearer session-token' }, body: {
    messages: [{ role: 'user', content: 'Role um d20' }], context: {}
  } }, dice);
  assert.equal(dice.statusCode, 200);
  assert.match(dice.body.reply, /resultado da rolagem/i);
  assert.equal(requests.length, 2);
  const toolResultMessage = requests[1].body.messages.find(message => message.role === 'tool');
  assert.ok(toolResultMessage);
  const rolled = JSON.parse(toolResultMessage.content);
  assert.equal(rolled.tool, 'roll_dice');
  assert.equal(rolled.ok, true);
  assert.ok(rolled.result.total >= 1 && rolled.result.total <= 20);

  // Persistent memory is searched through the authenticated Supabase RPC, not just the prompt snippet.
  const memoryRequests = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/rest/v1/rpc/a_profecia_whoami')) return new Response(JSON.stringify({ role: 'master' }), { status: 200 });
    if (target.includes('/rest/v1/rpc/a_profecia_ashen_memory_list')) {
      memoryRequests.push(JSON.parse(options.body));
      return new Response(JSON.stringify([{ id: 'm1', title: 'O sino', content: 'O sino toca quando Rher se aproxima.' }]), { status: 200 });
    }
    const payload = JSON.parse(options.body || '{}');
    memoryRequests.push(payload);
    if (memoryRequests.length === 1) return new Response(JSON.stringify({ model: 'gpt-5-mini', choices: [{ message: {
      role: 'assistant', content: null, tool_calls: [{ id: 'call-memory', type: 'function', function: {
        name: 'search_memory', arguments: JSON.stringify({ query: 'Rher' })
      } }]
    } }] }), { status: 200 });
    return new Response(JSON.stringify({ model: 'gpt-5-mini', choices: [{ message: { content: 'Encontrei a lembrança sobre o sino.' } }] }), { status: 200 });
  };
  const memory = makeResponse();
  await handler({ method: 'POST', headers: { authorization: 'Bearer session-token' }, body: {
    messages: [{ role: 'user', content: 'O que sabemos sobre Rher?' }], context: { memories: [] }
  } }, memory);
  assert.equal(memory.statusCode, 200);
  assert.match(memory.body.reply, /lembrança sobre o sino/i);
  assert.ok(memoryRequests.some(body => body.p_search === 'Rher'));

  // A non-Master may not query the assistant.
  globalThis.fetch = async () => new Response(JSON.stringify({ role: 'player' }), { status: 200 });
  const denied = makeResponse();
  await handler({ method: 'POST', headers: { authorization: 'Bearer player-token' }, body: { messages: [{ role: 'user', content: 'oi' }] } }, denied);
  assert.equal(denied.statusCode, 403);
  console.log('ashen-ai-api: PASS (tool calling, queued action proposals, dice execution, persistent memory search, master auth)');
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
