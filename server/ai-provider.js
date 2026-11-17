const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const DEFAULT_GATEWAY_MODEL = 'openai/gpt-5-mini';
const DEFAULT_OPENAI_BASE = 'https://api.openai.com';
const DEFAULT_GATEWAY_BASE = 'https://ai-gateway.vercel.sh';
const DEFAULT_ANTHROPIC_BASE = 'https://api.anthropic.com';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';
const CUSTOM_KEY_NAMES = ['filiabissy', 'FILIABISSY', 'Filiabissy'];

function normalizeBase(value, fallback) {
  const base = String(value || fallback).trim().replace(/\/+$/, '');
  return base.replace(/\/v1$/, '');
}

export function aiConfig() {
  const customName = CUSTOM_KEY_NAMES.find((name) => String(process.env[name] || '').trim());
  if (customName) {
    const key = String(process.env[customName]).trim();
    const forced = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
    const provider = forced || (key.startsWith('sk-ant-') ? 'anthropic' : key.startsWith('vck_') ? 'gateway' : 'openai');
    if (provider === 'anthropic') return { kind: 'anthropic', key, base: normalizeBase(process.env.ANTHROPIC_BASE_URL, DEFAULT_ANTHROPIC_BASE), model: String(process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL).trim() };
    if (provider === 'gateway') return { kind: 'openai', key, base: normalizeBase(process.env.AI_GATEWAY_BASE_URL, DEFAULT_GATEWAY_BASE), model: String(process.env.AI_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL).trim() };
    return { kind: 'openai', key, base: normalizeBase(process.env.OPENAI_BASE_URL, DEFAULT_OPENAI_BASE), model: String(process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() };
  }

  const openaiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (openaiKey) return { kind: 'openai', key: openaiKey, base: normalizeBase(process.env.OPENAI_BASE_URL, DEFAULT_OPENAI_BASE), model: String(process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() };
  const gatewayKey = String(process.env.AI_GATEWAY_API_KEY || '').trim();
  if (gatewayKey) return { kind: 'openai', key: gatewayKey, base: normalizeBase(process.env.AI_GATEWAY_BASE_URL, DEFAULT_GATEWAY_BASE), model: String(process.env.AI_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL).trim() };
  const anthropicKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (anthropicKey) return { kind: 'anthropic', key: anthropicKey, base: normalizeBase(process.env.ANTHROPIC_BASE_URL, DEFAULT_ANTHROPIC_BASE), model: String(process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL).trim() };
  return null;
}

export async function callProvider(config, system, messages, maxOutputTokens = 4000) {
  if (config.kind === 'anthropic') {
    const response = await fetch(`${config.base}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': config.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.model, max_tokens: maxOutputTokens, system, messages }),
    });
    const data = await response.json().catch(() => ({}));
    const text = Array.isArray(data?.content) ? data.content.filter((block) => block?.type === 'text').map((block) => block.text).join('\n').trim() : '';
    return { response, data, text, model: data?.model || config.model };
  }

  const response = await fetch(`${config.base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.key}` },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: system }, ...messages], max_completion_tokens: maxOutputTokens }),
  });
  const data = await response.json().catch(() => ({}));
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  return { response, data, text, model: data?.model || config.model };
}
