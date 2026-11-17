import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../src/supabaseConfig.js';

import { aiConfig, callProvider } from '../server/ai-provider.js';

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
  while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
  return cleaned;
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

  const system = `Você é a IA de manutenção do site Ashen Testimony (antes A Profecia) / Filii-Abyssi.
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
