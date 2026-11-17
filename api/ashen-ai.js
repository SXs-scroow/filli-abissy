import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../src/supabaseConfig.js';
import { aiConfig, callProvider } from '../server/ai-provider.js';
import { buildCampaignContext, buildAshenSystemPrompt } from '../src/ashenAIContext.js';

const MAX_MESSAGES = 12;
const MAX_CONTENT = 6000;
const MAX_OUTPUT_TOKENS = 3500;

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(String(req.body || '{}')); } catch { return {}; }
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const cleaned = messages.slice(-MAX_MESSAGES).map((message) => ({
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: String(message?.content || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').slice(0, MAX_CONTENT),
  })).filter((message) => message.content.trim());
  while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();
  return cleaned;
}

async function requireMaster(req) {
  const authorization = req.headers?.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'SESSAO_INVALIDA' };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/a_profecia_whoami`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ p_token: token }),
  });
  if (!response.ok) return { ok: false, status: 401, error: 'SESSAO_INVALIDA' };
  const who = await response.json().catch(() => null);
  const role = Array.isArray(who) ? who[0]?.role : who?.role;
  return role === 'master' ? { ok: true, token } : { ok: false, status: 403, error: 'NAO_AUTORIZADO' };
}

async function loadMasterArchive(token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/a_profecia_campaign_archive_list`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ p_token: token, p_search: '', p_kind: 'all', p_include_archived: false }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const missing = response.status === 404 || /PGRST202|schema cache|could not find the function/i.test(String(error?.message || error?.code || ''));
    const failure = new Error(missing ? 'ARQUIVO_SCHEMA_AUSENTE' : 'ARQUIVO_INDISPONIVEL');
    failure.status = response.status;
    throw failure;
  }
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  let auth;
  try { auth = await requireMaster(req); }
  catch (error) {
    console.error('ashen-ai auth check failed', error);
    return json(res, 503, { error: 'AUTH_UNAVAILABLE', message: 'Não foi possível confirmar sua sessão com segurança. Tente novamente.' });
  }
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const body = parseBody(req);
  const messages = cleanMessages(body?.messages);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  if (!lastUserMessage) return json(res, 400, { error: 'MENSAGEM_VAZIA' });

  const config = aiConfig();
  if (!config) return json(res, 503, { error: 'AI_API_KEY_AUSENTE', message: 'A Ashen AI ainda não tem um provedor configurado neste deploy. Configure a variável de ambiente de IA e publique novamente.' });

  try {
    const archive = await loadMasterArchive(auth.token);
    const context = buildCampaignContext(archive, lastUserMessage.content);
    const moduleName = String(body?.module || 'geral').slice(0, 60);
    const integrity = body?.integrity && typeof body.integrity === 'object' ? body.integrity : null;
    const system = buildAshenSystemPrompt(context, moduleName, integrity);
    const { response, data, text, model } = await callProvider(config, system, messages, MAX_OUTPUT_TOKENS);
    if (!response.ok) {
      console.error('ashen-ai provider error', response.status, data?.error || data);
      return json(res, 502, { error: 'AI_PROVIDER_ERROR', message: data?.error?.message || 'O provedor de IA recusou a solicitação.' });
    }
    if (!text) return json(res, 502, { error: 'AI_EMPTY_RESPONSE', message: 'A IA não retornou uma resposta utilizável.' });
    return json(res, 200, {
      ok: true,
      message: text,
      model,
      context: { matchedRecords: context.matchedRecordCount, hasRelevantRecords: context.hasRelevantRecords, sources: context.records.map(({ id, title, kind, occurredAt, visibility }) => ({ id, title, kind, occurredAt, visibility })) },
    });
  } catch (error) {
    if (error?.message === 'ARQUIVO_SCHEMA_AUSENTE') return json(res, 503, { error: 'ARCHIVE_NOT_READY', message: 'O Arquivo de Campanha ainda não está disponível no Supabase. Aplique a migração do Arquivo antes de usar a memória da Ashen AI.' });
    if (error?.message === 'ARQUIVO_INDISPONIVEL') return json(res, 502, { error: 'CAMPAIGN_CONTEXT_UNAVAILABLE', message: 'Não foi possível consultar o Arquivo da campanha. A Ashen AI não responderá usando uma memória incompleta.' });
    console.error('ashen-ai error', error);
    return json(res, 502, { error: 'AI_UNAVAILABLE', message: 'Não foi possível concluir a consulta da Ashen AI agora.' });
  }
}
