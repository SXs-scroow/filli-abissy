import { supabase, getAuthToken, handleAuthError, authCheck, syncMarkOffline, syncMarkSyncing, syncMarkSuccess, syncMarkError } from './globalSync.js';

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

  // V1.4.3: nunca chama o RPC de roster sem um token. Isso evitava um 400
  // silencioso quando o cache da sessão sobrevivia ao token da aba.
  let token = getAuthToken();
  if (!token) {
    // Sem sessão não há motivo para consultar o RPC nem para transformar a
    // ausência normal de autenticação em erro de sincronização. O fluxo de
    // login é responsável por iniciar uma nova leitura.
    return [];
  }

  let result = await supabase.rpc('a_profecia_list_players', { p_token: token });
  if (result.error) {
    // Se o endpoint responder 400 por sessão inválida, confirma a sessão uma
    // única vez antes de entrar em modo somente-leitura. Assim não ficamos
    // repetindo requests com token morto e também não tratamos um 400 de
    // autenticação como falha genérica de banco.
    const errText = String(result.error?.message || '');
    const normalized = errText.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').toUpperCase();
    if (/SESSAO_INVALIDA|P0001.*SESSAO_INVALIDA/.test(normalized)) {
      handleAuthError(result.error);
      throw result.error;
    }
    try {
      const who = await authCheck();
      if (!who) {
        const e = new Error('SESSAO_INVALIDA');
        handleAuthError(e);
        throw e;
      }
      // Token ainda é válido segundo o servidor: repete uma única vez para
      // absorver uma falha transitória do PostgREST.
      token = getAuthToken();
      result = await supabase.rpc('a_profecia_list_players', { p_token: token });
    } catch (checkError) {
      if (/SESSAO_INVALIDA/.test(String(checkError?.message || ''))) throw checkError;
      throw result.error;
    }
  }
  if (result.error) throw handleAuthError(result.error);
  const data = result.data;

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
  const token = getAuthToken();
  if (!token) return [];
  const { data, error } = await supabase.rpc('a_profecia_get_players_by_ids', {
    p_token: token,
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


export async function restorePlayerServer(player) {
  if (!supabase) throw new Error('Supabase não configurado');
  const token = getAuthToken();
  if (!token) { const e = new Error('SESSAO_INVALIDA'); handleAuthError(e); throw e; }
  const id = String(player?.id || '').trim();
  const login = String(player?.login || '').trim();
  if (!id || !login) throw new Error('PLAYER_ID_INVALIDO');
  const data = { ...(player?.data || player || {}) };
  delete data.password; delete data.newPassword; delete data.secretLovedEffect;
  const { data: restored, error } = await supabase.rpc('a_profecia_player_restore', {
    p_token: token, p_id: id, p_login: login, p_data: data,
    p_sync_updated_at: syncStamp(data)
  });
  if (error) throw handleAuthError(error);
  rowCache.delete(id);
  return restored;
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
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { syncMarkOffline(); throw new Error('OFFLINE'); }
  syncMarkSyncing();
  const rows = players.map(p => ({
    id: String(p.id || '').trim(),
    login: String(p.login || '').trim(),
    data: p,
    updated_at: new Date(syncStamp(p)).toISOString(),
    deleted_at: null
  })).filter(r => r.id && r.login);
  if (!rows.length) return [];

  const saved = [];
  try {
    for (let i=0;i<rows.length;i++) {
      saved.push(await rpcUpsert(rows[i]));
      // Senha nova (definida pelo Mestre) já foi para o servidor como hash:
      // remova o texto assim que cada gravação for confirmada.
      try { delete players[i].newPassword; } catch {}
    }
    syncMarkSuccess();
    return saved;
  } catch (error) {
    queuePlayerRows(players);
    if (/OFFLINE/.test(String(error?.message||''))) syncMarkOffline();
    else syncMarkError('Alteração do Player pendente',pendingPlayerSyncCount());
    // Keep the local state; the durable queue will retry when connectivity returns.
    throw error;
  }
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


// V1.2.1 — fila durável, liderança entre abas e reconciliação.
const PLAYER_QUEUE_KEY='a_profecia_player_sync_queue_v1';
const PLAYER_LEADER_KEY='a_profecia_player_sync_leader_v1';
const PLAYER_TAB_ID=(globalThis.crypto?.randomUUID?.()||`tab-${Date.now()}-${Math.random().toString(36).slice(2)}`);
let queueFlushTimer=0;
let queueBusy=false;
let leaderTimer=0;
let presenceChannel=null;
let presenceTimer=0;
const localQueue=new Map();

function readQueue(){
  try{
    const raw=JSON.parse(localStorage.getItem(PLAYER_QUEUE_KEY)||'[]');
    if(Array.isArray(raw)) for(const item of raw){ if(item?.id)localQueue.set(String(item.id),item); }
  }catch{}
  return [...localQueue.values()];
}
function writeQueue(){try{localStorage.setItem(PLAYER_QUEUE_KEY,JSON.stringify([...localQueue.values()].slice(-100)))}catch{}}
function queuePlayerRows(players){
  readQueue();
  for(const p of players||[]){
    const id=String(p?.id||'').trim(); if(!id)continue;
    const old=localQueue.get(id);
    const base=rowCache.get(id)?.data || old?.baseData || null;
    localQueue.set(id,{id,login:String(p.login||''),data:p,baseData:base,queuedAt:old?.queuedAt||Date.now(),attempts:Number(old?.attempts)||0});
  }
  writeQueue();
  syncMarkError('Alteração do Player pendente',localQueue.size);
}
function removeQueued(id){localQueue.delete(String(id));writeQueue()}
function isLeader(){
  const now=Date.now();
  try{
    const current=JSON.parse(localStorage.getItem(PLAYER_LEADER_KEY)||'null');
    if(!current||!current.id||Number(current.expiresAt)<now||current.id===PLAYER_TAB_ID){
      localStorage.setItem(PLAYER_LEADER_KEY,JSON.stringify({id:PLAYER_TAB_ID,expiresAt:now+5000}));
      return true;
    }
  }catch{}
  return false;
}
function startLeaderLease(){
  clearInterval(leaderTimer);
  isLeader();
  leaderTimer=setInterval(()=>{if(isLeader())flushPlayerQueue().catch(()=>{})},2500);
}
async function flushPlayerQueue(){
  if(queueBusy||!supabase||!getAuthToken()||!isLeader()||typeof navigator!=='undefined'&&navigator.onLine===false)return false;
  readQueue(); if(!localQueue.size)return true;
  queueBusy=true;
  try{
    for(const item of [...localQueue.values()]){
      try{
        const saved=await rpcUpsert({id:item.id,login:item.login,data:item.data,deleted_at:null});
        const remoteStamp=syncStamp(saved?.data, Number(saved?.updated_at ? new Date(saved.updated_at).getTime() : 0));
        const localStamp=syncStamp(item.data, Number(item.queuedAt)||Date.now());
        if(saved?.data && remoteStamp && localStamp && remoteStamp < localStamp){
          const base=item.baseData || {};
          const remoteData={...(saved.data||{})};
          const localData={...(item.data||{})};
          const merged={...remoteData};
          const keys=new Set([...Object.keys(base),...Object.keys(remoteData),...Object.keys(localData)]);
          for(const k of keys){
            if(k==='_syncUpdatedAt') continue;
            const baseV=JSON.stringify(base[k]);
            const localV=JSON.stringify(localData[k]);
            if(localV!==baseV) merged[k]=localData[k];
          }
          merged._syncUpdatedAt=Date.now();
          await rpcUpsert({id:item.id,login:item.login,data:merged,deleted_at:null});
        }
        removeQueued(item.id);
      }catch(e){
        item.attempts=(Number(item.attempts)||0)+1; localQueue.set(item.id,item); writeQueue();
        if(/SESSAO_INVALIDA|NAO_AUTORIZADO/.test(String(e?.message||'')))break;
      }
    }
    if(localQueue.size)syncMarkError('Alterações aguardando sincronização',localQueue.size);
    else syncMarkSuccess('Sincronizado');
    return !localQueue.size;
  }finally{queueBusy=false}
}

export function pendingPlayerSyncCount(){readQueue();return localQueue.size}
export async function flushPendingPlayerSync(){return flushPlayerQueue()}
export function startPlayerSyncInfrastructure(){
  readQueue(); startLeaderLease();
  try{window.addEventListener('online',()=>{flushPlayerQueue().catch(()=>{})});window.addEventListener('visibilitychange',()=>{if(!document.hidden)flushPlayerQueue().catch(()=>{})})}catch{}
  flushPlayerQueue().catch(()=>{});
  return ()=>{clearInterval(leaderTimer);leaderTimer=0}
}

// Start only after module-scoped queue state has been initialized.
startPlayerSyncInfrastructure();

export function subscribePlayerPresence(sessionId, playerId, callback){
  if(!supabase||!sessionId||!playerId)return ()=>{};
  let disposed=false;
  const channel=supabase.channel(`a-profecia-presence-${String(sessionId)}`,{config:{presence:{key:String(playerId)}}});
  presenceChannel=channel;
  channel.on('presence',{event:'sync'},()=>{if(!disposed&&typeof callback==='function')callback(channel.presenceState())});
  channel.on('presence',{event:'join'},()=>{if(!disposed&&typeof callback==='function')callback(channel.presenceState())});
  channel.on('presence',{event:'leave'},()=>{if(!disposed&&typeof callback==='function')callback(channel.presenceState())});
  channel.subscribe(status=>{
    if(status==='SUBSCRIBED')channel.track({playerId:String(playerId),role:'player',lastSeen:Date.now()}).catch(()=>{});
  });
  presenceTimer=window.setInterval(()=>{if(!disposed)channel.track({playerId:String(playerId),role:'player',lastSeen:Date.now()}).catch(()=>{})},20000);
  return ()=>{disposed=true;clearInterval(presenceTimer);presenceTimer=0;try{supabase.removeChannel(channel)}catch{}if(presenceChannel===channel)presenceChannel=null}
}

export function subscribePlayers(callback) {
  if (!supabase) return () => {};
  let disposed = false, refreshTimer = null, reconnectTimer = null, channel = null;
  const pendingOps = new Map();
  const attach = () => {
    if (disposed) return;
    channel = supabase
      .channel(`a-profecia-players-events-${Date.now()}`)
      .on('broadcast', { event: 'player-changed' }, payload => {
        if (disposed) return;
        const changedId = String(payload?.payload?.id || '').trim();
        if (!changedId) return;
        pendingOps.set(changedId, String(payload?.payload?.op || '').toLowerCase());
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(async () => {
          if (disposed) return;
          const ids = [...pendingOps.keys()];
          const ops = new Map(pendingOps); pendingOps.clear();
          try {
            const rows = await fetchPlayersByIds(ids);
            const byId = new Map(rows.map(item => [String(item.id), item]));
            const missing = ids.filter(id => !byId.has(id) && ops.get(id) === 'delete');
            if (missing.length) {
              await new Promise(resolve => setTimeout(resolve, 220));
              try { const confirmRows = await fetchPlayersByIds(missing); for (const row of confirmRows) byId.set(String(row.id), row); } catch {}
            }
            for (const id of ids) {
              const found = byId.get(id);
              if (found) callback(found);
              else if (ops.get(id) === 'delete') callback({ id, deleted_at: 'deleted' });
            }
          } catch (error) {
            if (!/SESSAO_INVALIDA/.test(String(error?.message || ''))) console.warn('Falha ao atualizar Players em tempo real:', error);
          }
        }, 120);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(reconnectTimer); return; }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (disposed) return;
          try { supabase.removeChannel(channel); } catch {}
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(attach, 1200);
        }
      });
  };
  attach();
  return () => {
    disposed = true;
    clearTimeout(refreshTimer); clearTimeout(reconnectTimer);
    if (channel) supabase.removeChannel(channel).catch(() => {});
  };
}
