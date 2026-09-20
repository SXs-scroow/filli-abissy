import { supabase } from './globalSync.js';

const TABLE = 'a_profecia_players';
const RPC = 'a_profecia_upsert_player';

export const playerStoreEnabled = Boolean(supabase);

export async function fetchPlayers() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('id,login,data,updated_at,deleted_at')
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

function syncStamp(p, fallback = Date.now()) {
  const n = Number(p?._syncUpdatedAt);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function rpcUpsert(row) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(RPC, {
    p_id: row.id,
    p_login: row.login,
    p_data: row.data || {},
    p_sync_updated_at: syncStamp(row.data),
    p_deleted_at: row.deleted_at || null
  });
  if (error) throw error;
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

  for (const row of rows) await rpcUpsert(row);
  return await fetchPlayers();
}

export async function upsertPlayerTombstones(tombstones, playerIndex = {}) {
  if (!supabase || !tombstones || typeof tombstones !== 'object') return [];
  const rows = Object.entries(tombstones).map(([id, deletedAt]) => {
    const old = playerIndex[id] || {};
    const when = Number(deletedAt) || Date.now();
    return {
      id,
      login: String(old.login || '').trim() || id,
      data: { ...old, _syncUpdatedAt: when },
      updated_at: new Date(when).toISOString(),
      deleted_at: new Date(when).toISOString()
    };
  });
  if (!rows.length) return [];

  for (const row of rows) await rpcUpsert(row);
  return await fetchPlayers();
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
