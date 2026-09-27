import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../src/supabaseConfig.js';

const MODEL = 'gpt-5-mini';
const MAX_MESSAGES = 12;
const MAX_CONTENT = 12000;

async function requireMaster(req) {
  const auth = req.headers.get('authorization') || '';
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
  return messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content || '').slice(0, MAX_CONTENT)
  })).filter((m) => m.content.trim());
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });

  const auth = await requireMaster(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const openaiKey = Netlify.env.get('OPENAI_API_KEY');
  const openaiBase = Netlify.env.get('OPENAI_BASE_URL');
  if (!openaiKey || !openaiBase) {
    return Response.json({
      error: 'AI_GATEWAY_INDISPONIVEL',
      message: 'O AI Gateway da Netlify não está disponível neste ambiente. Verifique se os recursos de IA estão habilitados e faça um novo deploy.'
    }, { status: 503 });
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'JSON_INVALIDO' }, { status: 400 });
  }

  const messages = cleanMessages(body?.messages);
  const diagnostics = String(body?.diagnostics || '').slice(0, 18000);
  if (!messages.length) return Response.json({ error: 'MENSAGEM_VAZIA' }, { status: 400 });

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
    const response = await fetch(`${openaiBase.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: system }, ...messages],
        temperature: 0.2,
        max_tokens: 1200
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('maintenance-ai gateway error', response.status, data?.error || data);
      return Response.json({ error: 'AI_GATEWAY_ERRO', message: 'O gateway de IA recusou a solicitação.' }, { status: 502 });
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return Response.json({ error: 'AI_RESPOSTA_VAZIA' }, { status: 502 });
    return Response.json({ ok: true, model: data.model || MODEL, message: text });
  } catch (error) {
    console.error('maintenance-ai function error', error);
    return Response.json({ error: 'AI_INDISPONIVEL', message: 'Não foi possível alcançar o AI Gateway agora.' }, { status: 502 });
  }
};

export const config = {
  path: '/api/maintenance-ai',
  method: 'POST'
};
