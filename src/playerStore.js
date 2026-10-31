import { readStoredJson, writeStoredJson, getBrowserStorage } from './persistence/browserStorage.js';
import { mergePlayerQueueItems, serializePlayerQueue, sanitizePlayerQueueItem } from './persistence/playerQueue.js';
import { mapWithConcurrency } from './persistence/concurrency.js';
import { nextStamp, observeStamp, observePlayerStamps } from './stampClock.js';
import { supabase, getAuthToken, handleAuthError, authCheck, syncMarkOffline, syncMarkSyncing, syncMarkSuccess, syncMarkError } from './globalSync.js';

const TABLE = 'a_profecia_players';
const RPC = 'a_profecia_player_save';

export const playerStoreEnabled = Boolean(supabase);

// V66 (desempenho): antes, cada sincronização baixava TODAS as fichas por inteiro. Agora baixa só uma lista leve
// (id + carimbo) e busca por inteiro apenas as fichas que mudaram desde a última vez.
let rowCache = new Map();
let fetchCount = 0;
let rosterRequestInFlight = null;
const playerBatchRequestsInFlight = new Map();

async function fetchPlayersUnshared() {
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


// Coalesce leituras idênticas disparadas quase ao mesmo tempo dentro da mesma aba.
// Isso evita rajadas duplicadas em reconexões/visibilidade sem esconder gravações:
// cada reconciliação continua recebendo o resultado completo do servidor.
export function fetchPlayers() {
  if (rosterRequestInFlight) return rosterRequestInFlight;
  const request = fetchPlayersUnshared();
  rosterRequestInFlight = request;
  request.finally(() => { if (rosterRequestInFlight === request) rosterRequestInFlight = null; }).catch(() => {});
  return request;
}

async function fetchPlayersByIdsUnshared(clean, token) {
  const rows = [];
  for (let offset = 0; offset < clean.length; offset += 50) {
    // Não iniciar outro lote se a sessão mudou enquanto o anterior estava em voo.
    if (getAuthToken() !== token) throw new Error('SESSAO_INVALIDA');
    const batch = clean.slice(offset, offset + 50);
    const { data, error } = await supabase.rpc('a_profecia_get_players_by_ids', {
      p_token: token,
      p_ids: batch
    });
    if (error) throw handleAuthError(error);
    if (getAuthToken() !== token) throw new Error('SESSAO_INVALIDA');
    if (Array.isArray(data)) rows.push(...data);
  }
  return rows.filter(row => row?.id != null).map(row => ({
    id: String(row.id),
    login: String(row.login || ''),
    data: row.data && typeof row.data === 'object' ? row.data : {},
    updated_at: row.updated_at || null,
    deleted_at: row.deleted_at || null
  }));
}

export function fetchPlayersByIds(ids) {
  if (!supabase || !Array.isArray(ids) || !ids.length) return Promise.resolve([]);
  const clean = [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))].sort();
  if (!clean.length) return Promise.resolve([]);
  const token = getAuthToken();
  if (!token) return Promise.resolve([]);
  const key = `${token}:${clean.join('|')}`;
  if (playerBatchRequestsInFlight.has(key)) return playerBatchRequestsInFlight.get(key);
  const request = fetchPlayersByIdsUnshared(clean, token);
  playerBatchRequestsInFlight.set(key, request);
  request.finally(() => { if (playerBatchRequestsInFlight.get(key) === request) playerBatchRequestsInFlight.delete(key); }).catch(() => {});
  return request;
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

// V1.4.7 — histórico de versões no servidor (somente o Mestre).
export async function fetchPlayerHistory(playerId, limit = 80) {
  if (!supabase) throw new Error('Supabase não configurado');
  const token = getAuthToken();
  if (!token) { const e = new Error('SESSAO_INVALIDA'); handleAuthError(e); throw e; }
  const { data, error } = await supabase.rpc('a_profecia_player_history_list', { p_token: token, p_id: String(playerId || ''), p_limit: limit });
  if (error) throw handleAuthError(error);
  return Array.isArray(data) ? data : [];
}

export async function fetchPlayerHistoryEntry(playerId, historyId) {
  if (!supabase) throw new Error('Supabase não configurado');
  const token = getAuthToken();
  if (!token) { const e = new Error('SESSAO_INVALIDA'); handleAuthError(e); throw e; }
  const { data, error } = await supabase.rpc('a_profecia_player_history_get', { p_token: token, p_id: String(playerId || ''), p_history_id: Number(historyId) });
  if (error) throw handleAuthError(error);
  return data && typeof data === 'object' ? data : null;
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

  // Um lote do Mestre costuma conter vários Players independentes. Enviá-los
  // um a um somava uma ida completa à rede para cada ficha. Agora usamos até
  // quatro gravações em paralelo e mantemos ordem para alterações repetidas do
  // mesmo ID, sem abrir uma rajada ilimitada contra o Supabase.
  const rows = [];
  players.forEach((source) => {
    const id = String(source?.id || '').trim();
    const login = String(source?.login || '').trim();
    if (!id || !login) return;
    rows.push({ id, login, data: source, source, resultIndex: rows.length,
      updated_at: new Date(syncStamp(source)).toISOString(), deleted_at: null });
  });
  if (!rows.length) return [];

  const groupsById = new Map();
  for (const row of rows) {
    const group = groupsById.get(row.id) || [];
    group.push(row);
    groupsById.set(row.id, group);
  }
  const groups = [...groupsById.values()];
  const saved = new Array(rows.length);
  const failures = [];

  try {
    await mapWithConcurrency(groups, 4, async (group) => {
      // Same-player writes remain ordered; only distinct Player rows run in parallel.
      for (const row of group) {
        try {
          saved[row.resultIndex] = await rpcUpsert(row);
          // A senha definida pelo Mestre já foi enviada como hash; retire o texto
          // apenas do objeto de origem cujo salvamento foi confirmado.
          try { delete row.source.newPassword; } catch {}
        } catch (error) {
          failures.push(error);
          break;
        }
      }
    });
    if (failures.length) throw failures[0];
    syncMarkSuccess();
    return saved;
  } catch (error) {
    // Alguns itens podem já ter sido confirmados. Reenfileirar o lote inteiro é
    // seguro: os carimbos e o RPC do servidor impedem que uma resposta antiga
    // sobrescreva uma alteração mais nova.
    queuePlayerRows(players);
    if (/OFFLINE/.test(String(error?.message||''))) syncMarkOffline();
    else syncMarkError('Alteração do Player pendente',pendingPlayerSyncCount());
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
const PLAYER_QUEUE_KEY_BASE='a_profecia_player_sync_queue_v2';
const PLAYER_LEADER_KEY_BASE='a_profecia_player_sync_leader_v2';
const PLAYER_TAB_ID=(globalThis.crypto?.randomUUID?.()||`tab-${Date.now()}-${Math.random().toString(36).slice(2)}`);
let queueFlushTimer=0;
let queueBusy=false;
let leaderTimer=0;
let presenceChannel=null;
let presenceTimer=0;
const localQueue=new Map();
let activeQueueScope='';

// A fila de sincronização é específica da sessão. Sem esse isolamento, um
// Player que saísse da conta no mesmo navegador poderia deixar uma alteração
// pendente e essa alteração ser enviada posteriormente usando o token de outra
// conta. Tokens são aleatórios, então usamos um fingerprint estável do token
// somente como namespace de armazenamento; o token nunca é salvo na fila.
function queueScope(){
  const token=String(getAuthToken()||'');
  if(!token)return 'none';
  let h=2166136261;
  for(let i=0;i<token.length;i++){h^=token.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return h.toString(36);
}
function queueKey(){return `${PLAYER_QUEUE_KEY_BASE}:${queueScope()}`;}
function leaderKey(){return `${PLAYER_LEADER_KEY_BASE}:${queueScope()}`;}
function readQueue(){
  const scope=queueScope();
  // Nunca reutiliza itens em memória de outra sessão, mesmo sem recarregar a página.
  if(scope!==activeQueueScope){localQueue.clear();activeQueueScope=scope;}
  const raw=readStoredJson(queueKey(), [], getBrowserStorage());
  const merged=mergePlayerQueueItems([...localQueue.values()], Array.isArray(raw) ? raw : []);
  localQueue.clear();
  for(const item of merged) localQueue.set(String(item.id),item);
  return [...localQueue.values()];
}
function writeQueue(){
  // Não truncar a fila: descartar os itens mais antigos aqui causaria perda de
  // alterações pendentes após recarregar a página. Se exceder a quota, avisamos.
  const ok=writeStoredJson(queueKey(),serializePlayerQueue([...localQueue.values()]),getBrowserStorage());
  if(!ok){
    syncMarkError('Fila de sincronização não pôde ser salva neste dispositivo',localQueue.size);
    try{window.dispatchEvent(new CustomEvent('a-profecia-storage-error',{detail:{key:queueKey(),reason:'PLAYER_QUEUE_NOT_DURABLE'}}))}catch{}
  }
  return ok;
}
function queuePlayerRows(players){
  readQueue();
  for(const p of players||[]){
    const safePlayer=sanitizePlayerQueueItem({id:String(p?.id||'').trim(),login:String(p?.login||''),data:p});
    const id=String(safePlayer?.id||'').trim(); if(!id)continue;
    const old=localQueue.get(id);
    const base=rowCache.get(id)?.data || old?.baseData || null;
    const safeBase=base&&typeof base==='object'?sanitizePlayerQueueItem({id,data:base})?.data:null;
    // A fila em memória também é sanitizada: não basta retirar segredos apenas na escrita.
    localQueue.set(id,{id,login:String(safePlayer.login||''),data:safePlayer.data,baseData:safeBase,queuedAt:old?.queuedAt||Date.now(),attempts:Number(old?.attempts)||0});
  }
  writeQueue();
  syncMarkError('Alteração do Player pendente',localQueue.size);
}
function removeQueued(id){localQueue.delete(String(id));writeQueue()}
function isLeader(){
  const now=Date.now();
  // A liderança entre abas é uma otimização, não pode bloquear a sincronização.
  // Em navegadores que bloqueiam localStorage, a fila fica isolada em memória
  // por aba; permitir o flush local evita deixar alterações pendentes para sempre.
  const storage=getBrowserStorage();
  if(!storage)return true;
  try{
    const current=JSON.parse(storage.getItem(leaderKey())||'null');
    if(!current||!current.id||Number(current.expiresAt)<now||current.id===PLAYER_TAB_ID){
      storage.setItem(leaderKey(),JSON.stringify({id:PLAYER_TAB_ID,expiresAt:now+5000}));
      return true;
    }
    return false;
  }catch{
    // Falha no lease não deve desativar a gravação no servidor. Quando o
    // armazenamento falha, a fila local não é compartilhada entre abas.
    return true;
  }
}
function startLeaderLease(){
  clearInterval(leaderTimer);
  isLeader();
  leaderTimer=setInterval(()=>{if(isLeader())flushPlayerQueue().catch(()=>{})},2500);
}
async function flushPlayerQueue(){
  if(queueBusy||!supabase||!getAuthToken()||!isLeader()||typeof navigator!=='undefined'&&navigator.onLine===false)return false;
  readQueue(); if(!localQueue.size)return true;
  const flushScope=queueScope();
  const flushToken=String(getAuthToken()||'');
  if(!flushToken)return false;
  queueBusy=true;
  try{
    for(const item of [...localQueue.values()]){
      // Conta/token mudou durante a execução? Interrompe antes de tocar em outra fila.
      if(queueScope()!==flushScope||String(getAuthToken()||'')!==flushToken){
        localQueue.clear();activeQueueScope=queueScope();
        return false;
      }
      try{
        const saved=await rpcUpsert({id:item.id,login:item.login,data:item.data,deleted_at:null});
        if(queueScope()!==flushScope||String(getAuthToken()||'')!==flushToken){
          localQueue.clear();activeQueueScope=queueScope();
          return false;
        }
        if(saved)observePlayerStamps([saved]);
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
          merged._syncUpdatedAt=nextStamp();
          await rpcUpsert({id:item.id,login:item.login,data:merged,deleted_at:null});
        }
        // O servidor devolveu a ficha SEM os pontos que enviamos (carimbo perdeu a disputa)? Não dá a edição
        // como salva: renova os carimbos acima de tudo que já vimos e deixa na fila para a próxima rodada.
        const localPts=Number(item.data?._pointsAt)||0,savedPts=Number(saved?.data?._pointsAt)||0;
        if(saved?.data&&localPts>0&&savedPts<localPts&&
           (JSON.stringify(saved.data.attrs||{})!==JSON.stringify(item.data?.attrs||{})||JSON.stringify(saved.data.skills||{})!==JSON.stringify(item.data?.skills||{}))){
          observeStamp(savedPts);
          item.data={...item.data,_pointsAt:nextStamp(),_syncUpdatedAt:nextStamp()};
          throw new Error('PONTOS_NAO_CONFIRMADOS');
        }
        removeQueued(item.id);
      }catch(e){
        if(queueScope()!==flushScope||String(getAuthToken()||'')!==flushToken){
          localQueue.clear();activeQueueScope=queueScope();
          return false;
        }
        item.attempts=(Number(item.attempts)||0)+1; localQueue.set(item.id,item); writeQueue();
        if(/SESSAO_INVALIDA|NAO_AUTORIZADO/.test(String(e?.message||''))){
          // Falha de autenticação é terminal para esta tentativa; não martela o RPC.
          break;
        }
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
const stopStartedPlayerSyncInfrastructure = startPlayerSyncInfrastructure();
// Encerra o intervalo do leader lease iniciado acima. O navegador não precisa disso (o timer vive com a página),
// mas processos Node (suíte de caos) ficariam pendurados para sempre com o setInterval ativo.
export function stopPlayerSyncInfrastructure(){stopStartedPlayerSyncInfrastructure()}

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
  let flushAttempt = 0, eventSequence = 0, rosterRetryAttempt = 0, rosterRetryTimer = null, rosterRefreshTimer = null;
  let hasSubscribedOnce = false;
  const pendingOps = new Map();

  // Broadcasts are an acceleration path, not the only source of truth. After a
  // reconnect, browser resume, or network recovery, reconcile against the
  // server roster so an event missed while disconnected cannot leave stale UI.
  const refreshRoster = async () => {
    if (disposed || !getAuthToken() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    try {
      const rows = await fetchPlayers();
      if (disposed) return;
      rosterRetryAttempt = 0;
      for (const row of rows) {
        try { callback(row); } catch (error) { console.warn('Callback de reconciliação de Players falhou:', error); }
      }
    } catch (error) {
      if (disposed || /SESSAO_INVALIDA/.test(String(error?.message || ''))) return;
      rosterRetryAttempt = Math.min(rosterRetryAttempt + 1, 6);
      clearTimeout(rosterRetryTimer);
      rosterRetryTimer = setTimeout(() => { rosterRetryTimer = null; refreshRoster().catch(() => {}); }, Math.min(30000, 1000 * (2 ** (rosterRetryAttempt - 1))));
      console.warn('Reconciliação de Players adiada; haverá nova tentativa:', error);
    }
  };
  const scheduleRosterRefresh = (delay = 0) => {
    if (disposed || rosterRetryTimer || rosterRefreshTimer) return;
    rosterRefreshTimer = setTimeout(() => {
      rosterRefreshTimer = null;
      refreshRoster().catch(() => {});
    }, delay);
  };
  const onOnline = () => scheduleRosterRefresh(0);
  const onVisible = () => { if (!document.hidden) scheduleRosterRefresh(0); };
  try {
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
  } catch {}

  const scheduleFlush = (delay = 120) => {
    if (disposed || refreshTimer) return;
    refreshTimer = setTimeout(async () => {
      refreshTimer = null;
      if (disposed || !pendingOps.size) return;
      const batch = new Map(pendingOps);
      const ids = [...batch.keys()];
      try {
        const rows = await fetchPlayersByIds(ids);
        if (disposed) return;
        const byId = new Map(rows.map(item => [String(item.id), item]));
        const missingDeletes = ids.filter(id => !byId.has(id) && batch.get(id)?.op === 'delete');
        if (missingDeletes.length) {
          // Só considerar exclusão física após duas leituras bem-sucedidas.
          // Erro na segunda leitura não é evidência de que a ficha foi apagada.
          await new Promise(resolve => setTimeout(resolve, 220));
          const confirmRows = await fetchPlayersByIds(missingDeletes);
          if (disposed) return;
          for (const row of confirmRows) byId.set(String(row.id), row);
        }
        for (const id of ids) {
          const found = byId.get(id);
          if (found) callback(found);
          else if (batch.get(id)?.op === 'delete' && missingDeletes.includes(id)) callback({ id, deleted_at: 'deleted' });
          // Comparar a identidade do evento, não só o tipo: um UPDATE/DELETE novo
          // pode chegar enquanto a leitura está em andamento.
          if (pendingOps.get(id) === batch.get(id)) pendingOps.delete(id);
        }
        flushAttempt = 0;
        if (pendingOps.size) scheduleFlush(0);
      } catch (error) {
        if (!/SESSAO_INVALIDA/.test(String(error?.message || ''))) {
          console.warn('Falha ao atualizar Players em tempo real; evento será repetido:', error);
          flushAttempt = Math.min(flushAttempt + 1, 6);
          // Mantém os eventos na fila e usa backoff exponencial com limite para
          // não perder atualizações em falhas transitórias nem martelar o servidor.
          scheduleFlush(Math.min(1000 * (2 ** (flushAttempt - 1)), 30000));
        }
      }
    }, delay);
  };
  const attach = () => {
    if (disposed) return;
    channel = supabase
      // O trigger SQL publica neste tópico fixo. Um tópico com Date.now() nunca
      // receberia os eventos do banco, deixando os clientes dependentes do polling.
      .channel('a-profecia-players-events')
      .on('broadcast', { event: 'player-changed' }, payload => {
        if (disposed) return;
        const changedId = String(payload?.payload?.id || '').trim();
        if (!changedId) return;
        pendingOps.set(changedId, { op: String(payload?.payload?.op || '').toLowerCase(), sequence: ++eventSequence });
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = null;
        scheduleFlush(120);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(reconnectTimer); reconnectTimer = null;
          // Initial login already performs hydration. On a later subscribe the
          // WebSocket may have missed writes while disconnected: fetch truth.
          if (hasSubscribedOnce) scheduleRosterRefresh(0);
          hasSubscribedOnce = true;
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (disposed) return;
          try { Promise.resolve(supabase.removeChannel(channel)).catch(() => {}); } catch {}
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(attach, 1200);
        }
      });
  };
  attach();
  return () => {
    disposed = true;
    clearTimeout(refreshTimer); clearTimeout(reconnectTimer); clearTimeout(rosterRetryTimer); clearTimeout(rosterRefreshTimer);
    try { window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible); } catch {}
    if (channel) Promise.resolve(supabase.removeChannel(channel)).catch(() => {});
    pendingOps.clear();
  };
}
