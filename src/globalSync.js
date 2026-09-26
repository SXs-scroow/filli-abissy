import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabaseConfig.js';

// VITE_* continua tendo prioridade, mas o projeto também funciona imediatamente
// após o deploy porque existe uma configuração pública de fallback.
const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;

export const remoteEnabled = Boolean(url && key);
export const supabase = remoteEnabled
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const TABLE = 'a_profecia_global';
const ROW = 'main';
const BUCKET = 'a-profecia-assets';

export function publicUrl(path) {
  if (!supabase || !path) return '';
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || '';
}

// ===================== V66: autenticação no servidor =====================
// Login, senhas (hash bcrypt) e sessões vivem no Supabase (funções a_profecia_*). O navegador só guarda um token aleatório.
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
  if (/SESSAO_INVALIDA/.test(String(error?.message || ''))) {
    setAuthToken('');
    try { window.dispatchEvent(new CustomEvent('a-profecia-auth-expired')); } catch {}
  }
  return error;
}
async function rpc(name, args) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw handleAuthError(error);
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
export async function authLogout() {
  const token = getAuthToken();
  setAuthToken('');
  if (token && supabase) { try { await supabase.rpc('a_profecia_logout', { p_token: token }); } catch {} }
}
// Retorna {role, player_id} se a sessão é válida, null se não é; lança erro só quando não há rede.
export async function authCheck() {
  const token = getAuthToken();
  if (!token || !supabase) return null;
  const { data, error } = await supabase.rpc('a_profecia_whoami', { p_token: token });
  if (error) throw error;
  return data || null;
}
export async function changeMasterPassword(oldPassword, newPassword) {
  return await rpc('a_profecia_change_master_password', { p_token: getAuthToken(), p_old: String(oldPassword || ''), p_new: String(newPassword || '') });
}
// =========================================================================

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
  if (!getAuthToken()) { const e = new Error('SESSAO_INVALIDA'); handleAuthError(e); throw e; }
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // V66: só o Mestre autenticado grava; o servidor devolve apenas o carimbo (antes devolvia o estado inteiro de volta).
      const result = await rpc('a_profecia_push_global', { p_token: getAuthToken(), p_data: data });
      return { updated_at: result?.updated_at, verified: true };
    } catch (error) {
      lastError = error;
      if (/SESSAO_INVALIDA|NAO_AUTORIZADO|DADOS_/.test(String(error?.message || ''))) break;
      if (attempt < 3) await new Promise(r => setTimeout(r, 250 * attempt));
    }
  }
  throw lastError || new Error('Falha ao salvar o estado global.');
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
  const { data, error } = await supabase.functions.invoke('upload-asset', {
    body: file,
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      'x-asset-path': safePath,
      'x-asset-content-type': contentType
    }
  });
  if (error) throw handleAuthError(error);
  const publicPath = data?.path || safePath;
  const base = data?.url || publicUrl(publicPath);
  return base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : '';
}

export function subscribeGlobal(callback) {
  if (!supabase || typeof callback !== 'function') return () => {};
  let disposed = false;
  let timer = null;
  const channel = supabase
    .channel('a-profecia-global-events')
    .on('broadcast', { event: 'global-changed' }, () => {
      if (disposed) return;
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
      }, 80);
    })
    .subscribe();
  return () => {
    disposed = true;
    clearTimeout(timer);
    supabase.removeChannel(channel).catch(() => {});
  };
}


let liveChannel = null;
let liveReady = null;
let liveSubscribers = new Map();

async function ensureLiveChannel() {
  if (!supabase) return null;
  if (liveChannel && liveReady) {
    await liveReady.catch(() => {});
    return liveChannel;
  }

  const channel = supabase.channel('a-profecia-live-v2', {
    config: { broadcast: { self: false } }
  });
  liveChannel = channel;
  liveReady = new Promise((resolve, reject) => {
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') resolve();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
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
  const events = ['sound-trigger','secret-clue','session-start','tv-scene','nexus-join','nexus-offer','nexus-answer','nexus-ice','nexus-start','nexus-stop','session-join','session-join-ack'];
  let disposed = false;
  let retryTimer = null;

  const attach = async () => {
    try {
      const channel = await ensureLiveChannel();
      if (disposed || !channel) return;
      liveSubscribers.set(id, callback);
      for (const event of events) {
        channel.on('broadcast', { event }, ({ payload }) => {
          if (!disposed) callback({ event, payload: payload || {} });
        });
      }
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
    if (liveSubscribers.size === 0 && liveChannel) {
      const channel = liveChannel;
      liveChannel = null;
      liveReady = null;
      supabase.removeChannel(channel).catch(() => {});
    }
  };
}
