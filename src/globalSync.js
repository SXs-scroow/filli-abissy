import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const remoteEnabled = Boolean(url && key);
export const supabase = remoteEnabled ? createClient(url, key, { auth:{ persistSession:false } }) : null;
const TABLE='a_profecia_global';
const ROW='main';
const BUCKET='a-profecia-assets';

export function publicUrl(path){
  if(!supabase || !path) return '';
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || '';
}
export async function fetchGlobal(){
  if(!supabase) return null;
  const {data,error}=await supabase.from(TABLE).select('data,updated_at').eq('id',ROW).maybeSingle();
  if(error) throw error;
  return data?.data || null;
}
export async function pushGlobal(data){
  if(!supabase) return;
  const {error}=await supabase.from(TABLE).upsert({id:ROW,data,updated_at:new Date().toISOString()});
  if(error) throw error;
}
export async function uploadGlobalFile(path,file){
  if(!supabase) throw new Error('Supabase não configurado');
  const {error}=await supabase.storage.from(BUCKET).upload(path,file,{upsert:true,contentType:file.type||undefined,cacheControl:'3600'});
  if(error) throw error;
  return publicUrl(path);
}
export function subscribeGlobal(callback){
  if(!supabase) return ()=>{};
  const channel=supabase.channel('a-profecia-global-sync')
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:TABLE,filter:`id=eq.${ROW}`},payload=>callback(payload.new?.data||null))
    .subscribe();
  return ()=>supabase.removeChannel(channel);
}
