import { readStoredJson, writeStoredJson } from './persistence/browserStorage.js';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabaseConfig.js';

const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;

export const remoteEnabled = Boolean(url && key);
export const supabase = remoteEnabled
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;


const SYNC_HEALTH_KEY='a_profecia_sync_health_v1';
let syncHealthState={state:'idle',message:'Aguardando sincronização',lastSuccessAt:0,lastErrorAt:0,pending:false,attempts:0};
function readSyncHealth(){const x=readStoredJson(SYNC_HEALTH_KEY,null);if(x&&typeof x==='object')syncHealthState={...syncHealthState,...x};return {...syncHealthState}}
function writeSyncHealth(patch){syncHealthState={...readSyncHealth(),...patch};writeStoredJson(SYNC_HEALTH_KEY,syncHealthState);try{window.dispatchEvent(new CustomEvent('a-profecia-sync-status',{detail:{...syncHealthState}}))}catch{};return {...syncHealthState}}
export function syncHealth(){return readSyncHealth()}
export function syncMarkOffline(message='Offline — alterações ficam salvas neste dispositivo'){return writeSyncHealth({state:'offline',message,pending:true})}
export function syncMarkSyncing(message='Sincronizando…'){return writeSyncHealth({state:'syncing',message,pending:true})}
export function syncMarkSuccess(message='Sincronizado'){return writeSyncHealth({state:'synced',message,pending:false,lastSuccessAt:Date.now(),attempts:0})}
export function syncMarkError(message='Sincronização pendente',attempts=0){return writeSyncHealth({state:'error',message,pending:true,lastErrorAt:Date.now(),attempts:Number(attempts)||0})}

const TABLE = 'a_profecia_global';
const ROW = 'main';
const BUCKET = 'a-profecia-assets';

export function publicUrl(path) {
  if (!supabase || !path) return '';
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || '';
}

const TOKEN_KEY = 'a_profecia_auth_token_v1';
export function getAuthToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setAuthToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}
export function handleAuthError(error) {
  const raw = String(error?.message || error || '');
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').toUpperCase();
  if (/SESSAO_INVALIDA|SESSAO_INVALIDA|P0001.*SESSAO_INVALIDA/.test(normalized)) {
    setAuthToken('');
    try { window.dispatchEvent(new CustomEvent('a-profecia-auth-expired')); } catch {}
  }
  return error;
}
const SESSION_PUZZLE_RPCS = new Set([
  'a_profecia_session_puzzles_list', 'a_profecia_session_puzzle_save',
  'a_profecia_session_puzzle_delete', 'a_profecia_session_puzzle_unlock',
  'a_profecia_session_master_notes_get', 'a_profecia_session_master_notes_save'
]);
let sessionPuzzleSchemaUnavailable = false;
function isMissingSessionPuzzleRpc(error) {
  const code = String(error?.code || '').toUpperCase();
  const status = Number(error?.status) || 0;
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return code === 'PGRST202' || status === 404 || /could not find the function|schema cache|PGRST202|a_profecia_session_.*not found/i.test(message);
}
function sessionPuzzleSchemaError() {
  const error = new Error('As funções de puzzles não estão registradas no Supabase. Execute supabase/migrations/20261014120000_session_puzzles.sql no SQL Editor e recarregue o site.');
  error.code = 'PGRST202'; error.status = 404; error.schemaMissing = true;
  return error;
}
async function rpc(name, args) {
  if (!supabase) throw new Error('Supabase não configurado');
  if (SESSION_PUZZLE_RPCS.has(name) && sessionPuzzleSchemaUnavailable) throw sessionPuzzleSchemaError();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (SESSION_PUZZLE_RPCS.has(name) && isMissingSessionPuzzleRpc(error)) {
      sessionPuzzleSchemaUnavailable = true;
      const actionable = sessionPuzzleSchemaError();
      actionable.details = error?.details || '';
      actionable.hint = error?.hint || '';
      actionable.cause = error;
      throw actionable;
    }
    throw handleAuthError(error);
  }
  return data;
}
export function authErrorText(error) {
  const m = String(error?.message || error || '');
  if (/MUITAS_TENTATIVAS/.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (/LOGIN_EXISTE/.test(m)) return 'Esse login já existe.';
  if (/LOGIN_RESERVADO/.test(m)) return 'Esse login é reservado ao Mestre.';
  if (/LOGIN_INVALIDO/.test(m)) return 'O login deve ter de 3 a 32 caracteres.';
  if (/SENHA_INVALIDA/.test(m)) return 'A senha deve ter de 4 a 72 caracteres.';
  if (/SENHA_FRACA/.test(m)) return 'Use uma senha com pelo menos 10 caracteres.';
  if (/SESSAO_INVALIDA/.test(m)) return 'Sua sessão expirou. Entre novamente.';
  if (/NAO_AUTORIZADO/.test(m)) return 'Você não tem permissão para essa ação.';
  if (/PLAYER_EXCLUIDO/.test(m)) return 'Esta ficha já foi excluída e não pode ser restaurada automaticamente.';
  if (/PLAYER_ID_INVALIDO/.test(m)) return 'Não foi possível identificar esta ficha.';
  if (/EXCLUSAO_NAO_CONFIRMADA/.test(m)) return 'A exclusão não foi confirmada pelo servidor. Nenhum dado local foi removido permanentemente.';
  return 'Não foi possível conectar ao servidor. Tente novamente.';
}
export async function authMasterLogin(password) {
  const token = await rpc('a_profecia_master_login', { p_password: String(password || '') });
  if (!token) return false;
  setAuthToken(token);
  return true;
}
export async function authPlayerLogin(login, password) {
  const r = await rpc('a_profecia_player_login', { p_login: String(login || ''), p_password: String(password || '') });
  if (!r?.token) return null;
  setAuthToken(r.token);
  return r;
}
export async function authRegisterPlayer(login, password, player) {
  const r = await rpc('a_profecia_register_player', { p_login: String(login || ''), p_password: String(password || ''), p_player: player || {} });
  if (r?.token) setAuthToken(r.token);
  return r;
}
export async function getPlayerMasterSecret(playerId) {
  return await rpc('a_profecia_player_master_secret_get', { p_token: getAuthToken(), p_player_id: String(playerId || '') });
}
export async function savePlayerMasterSecret(playerId, secretLovedEffect) {
  return await rpc('a_profecia_player_master_secret_save', { p_token: getAuthToken(), p_player_id: String(playerId || ''), p_secret_loved_effect: String(secretLovedEffect || '') });
}

export async function listSessionPuzzles(sessionId) {
  return await rpc('a_profecia_session_puzzles_list', { p_token: getAuthToken(), p_session_id: String(sessionId || '') });
}
export async function saveSessionPuzzle(sessionId, puzzle) {
  return await rpc('a_profecia_session_puzzle_save', { p_token: getAuthToken(), p_session_id: String(sessionId || ''), p_puzzle: puzzle || {} });
}
export async function deleteSessionPuzzle(sessionId, puzzleId) {
  return await rpc('a_profecia_session_puzzle_delete', { p_token: getAuthToken(), p_session_id: String(sessionId || ''), p_puzzle_id: String(puzzleId || '') });
}
export async function unlockSessionPuzzle(sessionId, puzzleId, login, password) {
  return await rpc('a_profecia_session_puzzle_unlock', { p_token: getAuthToken(), p_session_id: String(sessionId || ''), p_puzzle_id: String(puzzleId || ''), p_login: String(login || ''), p_password: String(password || '') });
}
export async function getSessionMasterNotes(sessionId) {
  return await rpc('a_profecia_session_master_notes_get', { p_token: getAuthToken(), p_session_id: String(sessionId || '') });
}
export async function saveSessionMasterNotes(sessionId, notes) {
  return await rpc('a_profecia_session_master_notes_save', { p_token: getAuthToken(), p_session_id: String(sessionId || ''), p_notes: String(notes || '') });
}
export async function changePlayerPassword(playerId, newPassword) {
  return await rpc('a_profecia_player_set_password', {
    p_token: getAuthToken(),
    p_player_id: String(playerId || ''),
    p_new_password: String(newPassword || '')
  });
}
export async function authLogout() {
  const token = getAuthToken();
  setAuthToken('');
  if (token && supabase) { try { await supabase.rpc('a_profecia_logout', { p_token: token }); } catch {} }
}
export async function authCheck() {
  const token = getAuthToken();
  if (!token || !supabase) return null;
  const { data, error } = await supabase.rpc('a_profecia_whoami', { p_token: token });
  if (error) throw handleAuthError(error);
  if (!data) {
    const e = new Error('SESSAO_INVALIDA');
    handleAuthError(e);
    return null;
  }
  return data;
}
export async function changeMasterPassword(oldPassword, newPassword) {
  return await rpc('a_profecia_change_master_password', { p_token: getAuthToken(), p_old: String(oldPassword || ''), p_new: String(newPassword || '') });
}

export async function fetchGlobal() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('a_profecia_get_global', {
    p_token: getAuthToken()
  });
  if (error) throw handleAuthError(error);
  return data || null;
}


export async function backupGlobal(data, label = 'auto') {
  if (!supabase || !data) return null;
  return await rpc('a_profecia_backup_global', { p_token: getAuthToken(), p_data: data, p_label: String(label || 'auto') });
}

export async function listGlobalBackups(limit = 20) {
  if (!supabase) return [];
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const { data, error } = await supabase.rpc('a_profecia_list_global_backups', {
    p_token: getAuthToken(),
    p_limit: safeLimit
  });
  if (error) throw handleAuthError(error);
  return Array.isArray(data) ? data : [];
}

export async function pushGlobal(data) {
  if (!supabase) throw new Error('Supabase não está configurado.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { syncMarkOffline(); throw new Error('OFFLINE'); }
  if (!getAuthToken()) { const e = new Error('SESSAO_INVALIDA'); handleAuthError(e); throw e; }
  syncMarkSyncing();
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await rpc('a_profecia_push_global', { p_token: getAuthToken(), p_data: data });
      syncMarkSuccess();
      Promise.resolve(broadcastLive('global-changed', { updated_at: result?.updated_at || null }))
        .catch(error => console.warn('Estado global salvo; aviso Realtime não enviado:', error));
      return { updated_at: result?.updated_at, verified: true };
    } catch (error) {
      lastError = error;
      if (/SESSAO_INVALIDA|NAO_AUTORIZADO|DADOS_/.test(String(error?.message || ''))) break;
      if (attempt < 3) await new Promise(r => setTimeout(r, 250 * attempt));
    }
  }
  syncMarkError('Sincronização global pendente', 3);
  throw lastError || new Error('Falha ao salvar o estado global.');
}

async function explainUploadError(error) {
  let code = '', detail = '';
  try {
    const body = await error?.context?.json?.();
    code = String(body?.error || '');
    detail = String(body?.detail || '');
  } catch {}
  if (code === 'unauthorized') return handleAuthError(new Error('SESSAO_INVALIDA'));
  const messages = {
    unsupported_file_type: 'Formato não suportado. Use MP4, WebM, MOV, M4V ou OGV.',
    file_too_large: 'O arquivo excede o limite de 200 MB.',
    forbidden: 'Sem permissão para enviar para esta pasta.',
    method_not_allowed: 'Requisição de upload inválida.'
  };
  if (code === 'upload_failed') {
    return new Error(/exceed|size|large|payload/i.test(detail)
      ? 'O arquivo passa do limite de tamanho configurado no Storage do Supabase.'
      : `Falha ao gravar no Storage${detail ? `: ${detail}` : '.'}`);
  }
  if (messages[code]) return new Error(messages[code]);
  return handleAuthError(error);
}

async function uploadDirectToStorage(safePath, file, contentType) {
  let signed;
  try {
    const { data, error } = await supabase.functions.invoke('upload-asset', {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        'x-asset-path': safePath,
        'x-asset-content-type': contentType,
        'x-asset-mode': 'sign',
        'x-asset-size': String(file.size)
      }
    });
    if (error) {
      const known = await explainUploadError(error);
      if (/Formato não suportado|excede o limite|Sessão|SESSAO|permissão/i.test(String(known?.message || known))) throw known;
      return '';
    }
    signed = data;
  } catch (err) {
    if (/Formato não suportado|excede o limite|Sessão|SESSAO|permissão/i.test(String(err?.message || err))) throw err;
    return '';
  }
  if (!signed?.token || signed.mode !== 'sign') return '';
  const { error: upError } = await supabase.storage.from(BUCKET).uploadToSignedUrl(
    signed.path || safePath, signed.token, file, { contentType: signed.contentType || contentType, upsert: true }
  );
  if (upError) {
    const msg = String(upError.message || upError);
    if (/exceed|size|large|payload/i.test(msg)) throw new Error('O arquivo passa do limite de tamanho configurado no Storage do Supabase (Storage → Settings → Upload file size limit).');
    throw new Error('Falha ao enviar o arquivo ao Storage: ' + msg.slice(0, 160));
  }
  const base = signed.url || publicUrl(signed.path || safePath);
  return base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : '';
}
export async function uploadGlobalFile(path, file) {
  if (!supabase) throw new Error('Supabase não configurado');
  if (!getAuthToken()) throw new Error('SESSAO_INVALIDA');
  if (!file || typeof file.size !== 'number') throw new Error('ARQUIVO_INVALIDO');
  const safePath = String(path || '').replace(/\\/g, '/');
  if (!safePath || safePath.startsWith('/') || safePath.includes('..') || safePath.length > 300) {
    throw new Error('CAMINHO_INVALIDO');
  }
  const maxBytes = 200 * 1024 * 1024;
  if (file.size <= 0 || file.size > maxBytes) throw new Error('ARQUIVO_GRANDE');
  const contentType = file.type || 'application/octet-stream';
  if (file.size > 4 * 1024 * 1024) {
    const direct = await uploadDirectToStorage(safePath, file, contentType);
    if (direct) return direct;
  }
  const { data, error } = await supabase.functions.invoke('upload-asset', {
    body: file,
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      'x-asset-path': safePath,
      'x-asset-content-type': contentType
    }
  });
  if (error) throw await explainUploadError(error);
  const publicPath = data?.path || safePath;
  const base = data?.url || publicUrl(publicPath);
  return base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : '';
}

export function subscribeGlobal(callback) {
  if (!supabase || typeof callback !== 'function') return () => {};
  let disposed = false, timer = null;
  const unsubscribe = subscribeLive(msg => {
    if (disposed || msg?.event !== 'global-changed') return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const row = await fetchGlobal();
        if (!disposed && row) callback(row);
      } catch (error) {
        if (!/SESSAO_INVALIDA/.test(String(error?.message || ''))) {
          console.warn('Falha ao atualizar o estado global:', error);
        }
      }
    }, 100);
  });
  return () => {
    disposed = true;
    clearTimeout(timer);
    unsubscribe();
  };
}

let liveChannel = null;
let liveReady = null;
let liveSubscribers = new Map();
const LIVE_EVENTS = ['sound-trigger','secret-clue','session-start','tv-scene','nexus-join','nexus-offer','nexus-answer','nexus-ice','nexus-start','nexus-stop','session-join','session-join-ack','global-changed'];
let liveReconnectTimer = null;

function dispatchLiveMessage(event, message) {
  const normalized = { event, payload: message?.payload || {} };
  for (const callback of [...liveSubscribers.values()]) {
    try { callback(normalized); }
    catch (error) { console.warn('Falha em assinante Realtime:', error); }
  }
}

function scheduleLiveReconnect() {
  if (liveReconnectTimer || liveSubscribers.size === 0 || typeof setTimeout !== 'function') return;
  liveReconnectTimer = setTimeout(async () => {
    liveReconnectTimer = null;
    if (liveSubscribers.size === 0) return;
    try {
      if (liveChannel) {
        const stale = liveChannel;
        liveChannel = null;
        liveReady = null;
        try { await supabase.removeChannel(stale); } catch {}
      }
      await ensureLiveChannel();
    } catch {
      scheduleLiveReconnect();
    }
  }, 2500);
}

async function ensureLiveChannel() {
  if (!supabase) return null;
  if (liveChannel && liveReady) {
    await liveReady.catch(() => {});
    if (liveChannel) return liveChannel;
  }

  const channel = supabase.channel('a-profecia-live-v2', {
    config: { broadcast: { self: false } }
  });
  for (const event of LIVE_EVENTS) {
    channel.on('broadcast', { event }, message => dispatchLiveMessage(event, message));
  }
  liveChannel = channel;
  let wasSubscribed = false;
  liveReady = new Promise((resolve, reject) => {
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        wasSubscribed = true;
        if (liveReconnectTimer) { clearTimeout(liveReconnectTimer); liveReconnectTimer = null; }
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (!wasSubscribed) reject(new Error(status));
        else if (liveChannel === channel) {
          liveChannel = null;
          liveReady = null;
          Promise.resolve(supabase.removeChannel(channel)).catch(() => {});
          scheduleLiveReconnect();
        }
      }
    });
  });
  try {
    await liveReady;
    return channel;
  } catch (error) {
    if (liveChannel === channel) {
      liveChannel = null;
      liveReady = null;
    }
    try { await supabase.removeChannel(channel); } catch {}
    throw error;
  }
}

export async function broadcastLive(event, payload = {}) {
  const channel = await ensureLiveChannel();
  if (!channel) return null;
  return channel.send({ type: 'broadcast', event, payload: { ...payload } });
}

export function subscribeLive(callback) {
  if (!supabase || typeof callback !== 'function') return () => {};
  const id = Symbol('live-subscriber');
  let disposed = false;
  let retryTimer = null;
  liveSubscribers.set(id, callback);

  const attach = async () => {
    try {
      await ensureLiveChannel();
    } catch (error) {
      if (!disposed) {
        console.warn('Realtime ao vivo indisponível:', error);
        retryTimer = setTimeout(attach, 2500);
      }
    }
  };
  attach();

  return () => {
    disposed = true;
    clearTimeout(retryTimer);
    liveSubscribers.delete(id);
    if (liveSubscribers.size === 0) {
      clearTimeout(liveReconnectTimer);
      liveReconnectTimer = null;
      if (liveChannel) {
        const channel = liveChannel;
        liveChannel = null;
        liveReady = null;
        Promise.resolve(supabase.removeChannel(channel)).catch(() => {});
      }
    }
  };
}
