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

export async function pushGlobal(data) {
  if (!supabase) return null;
  const payload = { id: ROW, data, updated_at: new Date().toISOString() };
  const { data: result, error } = await supabase
    .from(TABLE)
    .upsert(payload)
    .select('updated_at')
    .single();
  if (error) throw error;
  return result || null;
}

export async function uploadGlobalFile(path, file) {
  if (!supabase) throw new Error('Supabase não configurado');
  const contentType = file.type || (path.toLowerCase().endsWith('.jfif') ? 'image/jpeg' : undefined);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType, cacheControl: '60' });
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
