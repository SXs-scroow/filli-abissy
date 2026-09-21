import { supabase, getAuthToken, handleAuthError } from './globalSync.js';

const TABLE = 'a_profecia_players';
const RPC = 'a_profecia_player_save';

export const playerStoreEnabled = Boolean(supabase);

// V66 (desempenho): antes, cada sincronização baixava TODAS as fichas por inteiro. Agora baixa só uma lista leve
// (id + carimbo) e busca por inteiro apenas as fichas que mudaram desde a última vez.
let rowCache = new Map();
let fetchCount = 0;

export async function fetchPlayers() {
  if (!supabase) return [];
  if (++fetchCount % 20 === 0) rowCache = new Map(); // refresh completo de vez em quando, por segurança
  const light = await supabase
    .from(TABLE)
    .select('id,login,updated_at,deleted_at')
    .order('updated_at', { ascending: true });
  if (light.error) throw light.error;
  const list = light.data || [];
  const next = new Map();
  const changed = [];
  for (const r of list) {
    const c = rowCache.get(r.id);
    if (c && c.updated_at === r.updated_at && (c.deleted_at || null) === (r.deleted_at || null)) next.set(r.id, c);
    else changed.push(r.id);
  }
  if (changed.length) {
    const full = await supabase.from(TABLE).select('id,login,data,updated_at,deleted_at').in('id', changed);
    if (full.error) throw full.error;
    for (const r of full.data || []) next.set(r.id, r);
  }
  rowCache = next;
  return list.map(r => next.get(r.id)).filter(Boolean);
}

function syncStamp(p, fallback = Date.now()) {
  const n = Number(p?._syncUpdatedAt);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function rpcUpsert(row) {
  if (!supabase) return null;
  if (!getAuthToken()) { const e = new Error('SESSAO_INVALIDA'); handleAuthError(e); throw e; }
  const { data, error } = await supabase.rpc(RPC, {
    p_token: getAuthToken(),
    p_id: row.id,
    p_login: row.login,
    p_data: row.data || {},
    p_sync_updated_at: syncStamp(row.data),
    p_deleted_at: row.deleted_at || null
  });
  if (error) throw handleAuthError(error);
  rowCache.delete(row.id);
  return data;
}

export async function upsertPlayers(players) {
  if (!supabase || !Array.isArray(players) || !players.length) return [];
  const rows = players.map(p => ({
    id: String(p.id || '').trim(),
    login: String(p.login || '').trim(),
    data: p,
    updated_at: new Date(syncStamp(p)).toISOString(),
    deleted_at: null
  })).filter(r => r.id && r.login);
  if (!rows.length) return [];

  const saved = [];
  for (const row of rows) saved.push(await rpcUpsert(row));
  // Senha nova (definida pelo Mestre) já foi para o servidor como hash: não fica guardada em texto no aparelho.
  for (const p of players) { try { delete p.newPassword; } catch {} }
  return saved;
}

export async function upsertPlayerTombstones(tombstones, playerIndex = {}) {
  if (!supabase || !tombstones || typeof tombstones !== 'object') return [];
  const rows = Object.entries(tombstones).map(([id, deletedAt]) => {
    const old = playerIndex[id] || {};
    const when = Number(deletedAt) || Date.now();
    const { password, newPassword, ...safeOld } = old;
    return {
      id,
      login: String(old.login || '').trim() || id,
      data: { ...safeOld, _syncUpdatedAt: when },
      updated_at: new Date(when).toISOString(),
      deleted_at: new Date(when).toISOString()
    };
  });
  if (!rows.length) return [];

  const saved = [];
  for (const row of rows) saved.push(await rpcUpsert(row));
  return saved;
}

export function subscribePlayers(callback) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('a-profecia-players-sync-v2')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      payload => callback(payload.new || payload.old || null)
    )
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime dos Players indisponível:', status);
      }
    });
  return () => supabase.removeChannel(channel);
}
