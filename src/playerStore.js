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
  if (++fetchCount % 20 === 0) rowCache = new Map();

  const { data, error } = await supabase.rpc('a_profecia_list_players', {
    p_token: getAuthToken()
  });
  if (error) throw handleAuthError(error);

  const rows = Array.isArray(data) ? data : [];
  const next = new Map();
  for (const row of rows) {
    if (!row?.id) continue;
    const normalized = {
      id: String(row.id),
      login: String(row.login || ''),
      data: row.data && typeof row.data === 'object' ? row.data : {},
      updated_at: row.updated_at || null,
      deleted_at: row.deleted_at || null
    };
    next.set(normalized.id, normalized);
  }
  rowCache = next;
  return rows.map(row => next.get(String(row?.id || ''))).filter(Boolean);
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

export async function deletePlayerServer(playerId) {
  if (!supabase) throw new Error('Supabase não configurado');
  const token = getAuthToken();
  if (!token) { const e = new Error('SESSAO_INVALIDA'); handleAuthError(e); throw e; }
  const id = String(playerId || '').trim();
  if (!id) throw new Error('PLAYER_ID_INVALIDO');

  const { data, error } = await supabase.rpc('a_profecia_player_delete', {
    p_token: token,
    p_id: id
  });
  if (error) throw handleAuthError(error);
  rowCache.delete(id);
  return data || { id, found: false };
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
  for (let i=0;i<rows.length;i++) {
    saved.push(await rpcUpsert(rows[i]));
    // Senha nova (definida pelo Mestre) já foi para o servidor como hash:
    // remova o texto assim que cada gravação for confirmada.
    try { delete players[i].newPassword; } catch {}
  }
  return saved;
}

export async function upsertPlayerTombstones(tombstones, playerIndex = {}) {
  if (!supabase || !tombstones || typeof tombstones !== 'object') return [];
  const saved = [];
  // Deletion is a terminal server operation. Never use the normal save RPC to
  // recreate a deleted row with a deleted_at timestamp: a late save from another
  // device could otherwise race with it. The dedicated RPC is idempotent and
  // serializes the deletion on the database row.
  for (const [id, deletedAt] of Object.entries(tombstones)) {
    const key = String(id || '').trim();
    if (!key) continue;
    saved.push(await deletePlayerServer(key));
  }
  return saved;
}

export function subscribePlayers(callback) {
  if (!supabase) return () => {};
  let disposed = false;
  let refreshTimer = null;
  const pendingIds = new Set();
  const channel = supabase
    .channel('a-profecia-players-events')
    .on('broadcast', { event: 'player-changed' }, payload => {
      if (disposed) return;
      const changedId = String(payload?.payload?.id || '').trim();
      if (!changedId) return;
      pendingIds.add(changedId);
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        if (disposed) return;
        const ids = [...pendingIds];
        pendingIds.clear();
        try {
          // Uma única leitura por rajada de eventos. Todos os IDs recebidos
          // durante os 80ms são aplicados, evitando perder exclusões/criações
          // quando vários Players mudam quase ao mesmo tempo.
          const rows = await fetchPlayers();
          const byId = new Map(rows.map(item => [String(item.id), item]));
          for (const id of ids) {
            callback(byId.get(id) || { id, deleted_at: 'deleted' });
          }
        } catch (error) {
          if (!/SESSAO_INVALIDA/.test(String(error?.message || ''))) {
            console.warn('Falha ao atualizar Players em tempo real:', error);
          }
        }
      }, 80);
    })
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime dos Players indisponível:', status);
      }
    });
  return () => {
    disposed = true;
    clearTimeout(refreshTimer);
    supabase.removeChannel(channel);
  };
}

