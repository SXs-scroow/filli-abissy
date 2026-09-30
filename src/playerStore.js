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


export async function fetchPlayersByIds(ids) {
  if (!supabase || !Array.isArray(ids) || !ids.length) return [];
  const clean = [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))].slice(0, 50);
  if (!clean.length) return [];
  const { data, error } = await supabase.rpc('a_profecia_get_players_by_ids', {
    p_token: getAuthToken(),
    p_ids: clean
  });
  if (error) throw handleAuthError(error);
  const rows = Array.isArray(data) ? data : [];
  return rows.map(row => ({
    id: String(row.id),
    login: String(row.login || ''),
    data: row.data && typeof row.data === 'object' ? row.data : {},
    updated_at: row.updated_at || null,
    deleted_at: row.deleted_at || null
  }));
}

function syncStamp(p, fallback = Date.now()) {
  const n = Number(p?._syncUpdatedAt);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function rpcUpsert(row) {
  if (!supabase) return null;
  if (!getAuthToken()) { const e = new Error('SESSAO_INVALIDA'); handleAuthError(e); throw e; }
  const data = { ...(row.data || {}) };
  // Authentication secrets are managed only by the dedicated password RPC.
  // Never send plaintext password fields through the normal Player sync path.
  delete data.password;
  delete data.newPassword;
  // Segredo exclusivo do Mestre: nunca entra no JSON da ficha do Player.
  delete data.secretLovedEffect;
  const { data: saved, error } = await supabase.rpc(RPC, {
    p_token: getAuthToken(),
    p_id: row.id,
    p_login: row.login,
    p_data: data,
    p_sync_updated_at: syncStamp(data),
    p_deleted_at: row.deleted_at || null
  });
  if (error) throw handleAuthError(error);
  rowCache.delete(row.id);
  return saved;
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
  // O evento já informa o ID alterado. Nunca recarregue o roster inteiro só para
  // atualizar uma ficha: isso criava picos de rede/CPU e fazia a interface oscilar.
  const pendingOps = new Map();
  const channel = supabase
    .channel('a-profecia-players-events')
    .on('broadcast', { event: 'player-changed' }, payload => {
      if (disposed) return;
      const changedId = String(payload?.payload?.id || '').trim();
      if (!changedId) return;
      pendingOps.set(changedId, String(payload?.payload?.op || '').toLowerCase());
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        if (disposed) return;
        const ids = [...pendingOps.keys()];
        const ops = new Map(pendingOps);
        pendingOps.clear();
        try {
          const rows = await fetchPlayersByIds(ids);
          const byId = new Map(rows.map(item => [String(item.id), item]));
          const missing = ids.filter(id => !byId.has(id) && ops.get(id) === 'delete');
          // Um evento DELETE pode chegar antes de a leitura enxergar a mesma
          // mudança. Só confirmamos uma exclusão após uma segunda leitura curta;
          // isso evita transformar uma defasagem transitória do banco/realtime
          // em uma exclusão falsa.
          if (missing.length) {
            await new Promise(resolve => setTimeout(resolve, 220));
            try {
              const confirmRows = await fetchPlayersByIds(missing);
              for (const row of confirmRows) byId.set(String(row.id), row);
            } catch {}
          }
          for (const id of ids) {
            const found = byId.get(id);
            if (found) callback(found);
            else if (ops.get(id) === 'delete') callback({ id, deleted_at: 'deleted' });
          }
        } catch (error) {
          if (!/SESSAO_INVALIDA/.test(String(error?.message || ''))) {
            console.warn('Falha ao atualizar Players em tempo real:', error);
          }
        }
      }, 120);
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

