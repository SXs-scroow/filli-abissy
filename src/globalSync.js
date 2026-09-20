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

export async function fetchGlobal() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('data,updated_at')
    .eq('id', ROW)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}


export async function backupGlobal(data, label = 'auto') {
  if (!supabase || !data) return null;
  const id = `backup-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const payload = { id, data: { ...data, __backup: { label, createdAt: new Date().toISOString() } }, updated_at: new Date().toISOString() };
  const { error } = await supabase.from(TABLE).insert(payload);
  if (error) throw error;
  return id;
}

export async function listGlobalBackups(limit = 20) {
  if (!supabase) return [];
  const { data, error } = await supabase.from(TABLE).select('id,data,updated_at').like('id','backup-%').order('updated_at',{ascending:false}).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function pushGlobal(data) {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const payload = { id: ROW, data, updated_at: new Date().toISOString() };
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data: result, error } = await supabase
        .from(TABLE)
        .upsert(payload, { onConflict: 'id' })
        .select('updated_at,data')
        .single();
      if (error) throw error;
      if (!result?.data || typeof result.data !== 'object') {
        throw new Error('O Supabase confirmou a escrita, mas não devolveu o estado salvo.');
      }
      return { updated_at: result.updated_at, verified: true };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(r => setTimeout(r, 250 * attempt));
    }
  }
  throw lastError || new Error('Falha ao salvar o estado global.');
}

export async function uploadGlobalFile(path, file) {
  if (!supabase) throw new Error('Supabase não configurado');
  const contentType = file.type || (path.toLowerCase().endsWith('.jfif') ? 'image/jpeg' : undefined);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType, cacheControl: '31536000' });
  if (error) throw error;
  // Cache-buster: garante que todos os aparelhos peguem a imagem nova mesmo
  // quando o arquivo substitui outro no mesmo caminho.
  const base = publicUrl(path);
  return base ? `${base}${base.includes('?') ? '&' : '?'}v=${Date.now()}` : '';
}

export function subscribeGlobal(callback) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('a-profecia-global-sync-v2')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${ROW}` },
      payload => callback(payload.new || null)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}


let liveChannel = null;
let liveReady = null;
async function ensureLiveChannel() {
  if (!supabase) return null;
  if (liveChannel && liveReady) { await liveReady.catch(()=>{}); return liveChannel; }
  liveChannel = supabase.channel('a-profecia-live-v1', { config: { broadcast: { self: false } } });
  liveReady = new Promise((resolve, reject) => {
    liveChannel.subscribe(status => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
    });
  });
  await liveReady;
  return liveChannel;
}

export async function broadcastLive(event, payload = {}) {
  const channel = await ensureLiveChannel();
  if (!channel) return null;
  return channel.send({ type: 'broadcast', event, payload: { ...payload } });
}

export function subscribeLive(callback) {
  if (!supabase) return () => {};
  ensureLiveChannel().catch(() => {});
  if (!liveChannel) return () => {};
  const events = ['sound-trigger','secret-clue','session-start','tv-scene','nexus-join','nexus-offer','nexus-answer','nexus-ice','nexus-start','nexus-stop'];
  events.forEach(event => liveChannel.on('broadcast', { event }, ({ payload }) => callback({ event, payload: payload || {} })));
  return () => {};
}
