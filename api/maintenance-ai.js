import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../src/supabaseConfig.js';

const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const DEFAULT_GATEWAY_MODEL = 'openai/gpt-5-mini';
const DEFAULT_OPENAI_BASE = 'https://api.openai.com';
const DEFAULT_GATEWAY_BASE = 'https://ai-gateway.vercel.sh';
const DEFAULT_ANTHROPIC_BASE = 'https://api.anthropic.com';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';
// Modelos de raciocínio (gpt-5*) gastam parte do limite pensando; 1200 deixava a resposta vazia.
const MAX_OUTPUT_TOKENS = 4000;
const MAX_MESSAGES = 12;
const MAX_CONTENT = 12000;

function json(res, status, payload) {
  return res.status(status).json(payload);
}

async function requireMaster(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'SESSAO_INVALIDA' };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/a_profecia_whoami`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      // The RPC receives the app session token as p_token. The publishable key
      // remains the Supabase API credential for this public RPC call.
      authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
    },
    body: JSON.stringify({ p_token: token })
  });

  if (!response.ok) return { ok: false, status: 401, error: 'SESSAO_INVALIDA' };
  const who = await response.json().catch(() => null);
  const role = Array.isArray(who) ? who[0]?.role : who?.role;
  if (role !== 'master') return { ok: false, status: 403, error: 'NAO_AUTORIZADO' };
  return { ok: true };
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const cleaned = messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content || '').slice(0, MAX_CONTENT)
  })).filter((m) => m.content.trim());
  // Alguns provedores exigem que a conversa comece com 'user'.
  while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
  return cleaned;
}

// Aceita a base com ou sem '/v1' no final (ex.: OPENAI_BASE_URL vindo de gateways).
function normalizeBase(value, fallback) {
  const base = String(value || fallback).trim().replace(/\/+$/, '');
  return base.replace(/\/v1$/, '');
}

// Nomes aceitos para a chave personalizada do projeto (o Vercel diferencia maiúsculas de minúsculas).
const CUSTOM_KEY_NAMES = ['filiabissy', 'FILIABISSY', 'Filiabissy'];

function customConfig() {
  const name = CUSTOM_KEY_NAMES.find((n) => String(process.env[n] || '').trim());
  if (!name) return null;
  const key = String(process.env[name]).trim();
  // Detecta o provedor pelo formato da chave; AI_PROVIDER (openai | gateway | anthropic) força a escolha.
  const forced = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const provider = forced || (key.startsWith('sk-ant-') ? 'anthropic' : key.startsWith('vck_') ? 'gateway' : 'openai');
  if (provider === 'anthropic') {
    return { kind: 'anthropic', key, base: normalizeBase(process.env.ANTHROPIC_BASE_URL, DEFAULT_ANTHROPIC_BASE), model: String(process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL).trim() };
  }
  if (provider === 'gateway') {
    return { kind: 'openai', key, base: normalizeBase(process.env.AI_GATEWAY_BASE_URL, DEFAULT_GATEWAY_BASE), model: String(process.env.AI_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL).trim() };
  }
  return { kind: 'openai', key, base: normalizeBase(process.env.OPENAI_BASE_URL, DEFAULT_OPENAI_BASE), model: String(process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim() };
}

function aiConfig() {
  // Ordem: chave personalizada (filiabissy), OpenAI direto, Vercel AI Gateway, Anthropic direto.
  const custom = customConfig();
  if (custom) return custom;
  const directKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (directKey) {
    return {
      kind: 'openai',
      key: directKey,
      base: normalizeBase(process.env.OPENAI_BASE_URL, DEFAULT_OPENAI_BASE),
      model: String(process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim()
    };
  }

  const gatewayKey = String(process.env.AI_GATEWAY_API_KEY || '').trim();
  if (gatewayKey) {
    return {
      kind: 'openai',
      key: gatewayKey,
      base: normalizeBase(process.env.AI_GATEWAY_BASE_URL, DEFAULT_GATEWAY_BASE),
      model: String(process.env.AI_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL).trim()
    };
  }

  const anthropicKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (anthropicKey) {
    return {
      kind: 'anthropic',
      key: anthropicKey,
      base: normalizeBase(process.env.ANTHROPIC_BASE_URL, DEFAULT_ANTHROPIC_BASE),
      model: String(process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL).trim()
    };
  }

  return null;
}

async function callProvider(config, system, messages) {
  if (config.kind === 'anthropic') {
    const response = await fetch(`${config.base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: config.model, max_tokens: MAX_OUTPUT_TOKENS, system, messages })
    });
    const data = await response.json().catch(() => ({}));
    const text = Array.isArray(data?.content)
      ? data.content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n').trim()
      : '';
    return { response, data, text, model: data?.model || config.model };
  }

  // Sem 'temperature': os modelos gpt-5* só aceitam o valor padrão e devolvem erro 400 se ele for enviado.
  const response = await fetch(`${config.base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.key}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'system', content: system }, ...messages],
      max_completion_tokens: MAX_OUTPUT_TOKENS
    })
  });
  const data = await response.json().catch(() => ({}));
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  return { response, data, text, model: data?.model || config.model };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });

  const auth = await requireMaster(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const config = aiConfig();
  if (!config) {
    return json(res, 503, {
      error: 'AI_API_KEY_AUSENTE',
      message: 'A IA não encontrou OPENAI_API_KEY, AI_GATEWAY_API_KEY, ANTHROPIC_API_KEY nem filiabissy nas variáveis de ambiente deste deploy. Crie a variável no Vercel (Settings → Environment Variables) e faça um novo deploy.'
    });
  }

  const body = req.body && typeof req.body === 'object'
    ? req.body
    : (() => {
        try { return JSON.parse(String(req.body || '{}')); } catch { return {}; }
      })();

  const messages = cleanMessages(body?.messages);
  const diagnostics = String(body?.diagnostics || '').slice(0, 18000);
  if (!messages.length) return json(res, 400, { error: 'MENSAGEM_VAZIA' });

  const system = `Você é a IA de manutenção do site A Profecia / Filii-Abyssi.
Sua função é ajudar o Mestre a diagnosticar erros reais do site e propor correções seguras.
REGRAS ABSOLUTAS:
- Não invente que executou testes, alterou arquivos, fez deploy ou corrigiu algo.
- Não apague, recrie ou restaure Players.
- Não proponha SQL destrutivo nem alterações de autenticação sem necessidade.
- Priorize diagnóstico, causa provável, correção mínima e teste de validação.
- Preserve Players, fichas, sessões, Supabase, Realtime, cache e os sistemas existentes.
- Se a informação não for suficiente, peça o erro ou diagnóstico exato.
- Responda em português brasileiro, de forma prática e curta.

Diagnóstico atual fornecido pelo site:
${diagnostics || 'Nenhum diagnóstico adicional foi fornecido.'}`;

  try {
    const { response, data, text, model } = await callProvider(config, system, messages);
    if (!response.ok) {
      console.error('maintenance-ai provider error', response.status, data?.error || data);
      return json(res, 502, {
        error: 'AI_GATEWAY_ERRO',
        message: data?.error?.message || 'O provedor de IA recusou a solicitação.'
      });
    }

    if (!text) return json(res, 502, { error: 'AI_RESPOSTA_VAZIA' });
    return json(res, 200, { ok: true, model, message: text });
  } catch (error) {
    console.error('maintenance-ai function error', error);
    return json(res, 502, {
      error: 'AI_INDISPONIVEL',
      message: 'Não foi possível alcançar o provedor de IA agora.'
    });
  }
}
