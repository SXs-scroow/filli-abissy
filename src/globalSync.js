import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const remoteEnabled = Boolean(url && key);
export const supabase = remoteEnabled ? createClient(url, key, { auth:{ persistSession:false } }) : null;
const TABLE='a_profecia_global';
const ROW='main';
const BUCKET='a-profecia-assets';

function extensionOf(fileOrPath){
  const value=typeof fileOrPath==='string'?fileOrPath:String(fileOrPath?.name||'');
  return (value.split('.').pop()||'').toLowerCase();
}
function storageMime(file){
  const ext=extensionOf(file);
  if(ext==='jfif'||ext==='jpg'||ext==='jpeg') return 'image/jpeg';
  if(ext==='png') return 'image/png';
  if(ext==='webp') return 'image/webp';
  if(ext==='avif') return 'image/avif';
  if(ext==='gif') return 'image/gif';
  return file?.type||'application/octet-stream';
}
function uniquePath(path,file){
  const slash=path.lastIndexOf('/');
  const dir=slash>=0?path.slice(0,slash+1):'';
  const base=slash>=0?path.slice(slash+1):path;
  const dot=base.lastIndexOf('.');
  const stem=dot>0?base.slice(0,dot):base;
  const ext=extensionOf(file)||extensionOf(base)||'bin';
  // Cada envio recebe um nome novo. Isso evita depender de permissões UPDATE
  // do Storage e também impede o navegador de reutilizar uma imagem antiga do cache.
  return `${dir}${stem}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext==='jfif'?'jpg':ext}`;
}
function friendlyStorageError(error){
  const msg=String(error?.message||error?.error_description||'Erro desconhecido');
  const low=msg.toLowerCase();
  if(low.includes('bucket')&&(low.includes('not found')||low.includes('does not exist'))) return 'O bucket a-profecia-assets não existe no Supabase. Execute o arquivo SUPABASE_GLOBAL.sql no SQL Editor.';
  if(low.includes('row-level security')||low.includes('policy')||low.includes('permission denied')||low.includes('not authorized')) return 'O Supabase bloqueou o upload por permissão. Execute novamente o SUPABASE_GLOBAL.sql no SQL Editor.';
  if(low.includes('payload')||low.includes('too large')||low.includes('file size')) return 'A imagem excede o limite permitido pelo Storage.';
  return `Falha no upload do Supabase: ${msg}`;
}

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
  if(!file) throw new Error('Nenhum arquivo selecionado');
  const finalPath=uniquePath(path,file);
  const {data,error}=await supabase.storage.from(BUCKET).upload(finalPath,file,{
    upsert:false,
    contentType:storageMime(file),
    cacheControl:'3600'
  });
  if(error) throw new Error(friendlyStorageError(error));
  return publicUrl(data?.path||finalPath);
}
export function subscribeGlobal(callback){
  if(!supabase) return ()=>{};
  const channel=supabase.channel('a-profecia-global-sync')
    .on('postgres_changes',{event:'*',schema:'public',table:TABLE,filter:`id=eq.${ROW}`},payload=>callback(payload.new?.data||null))
    .subscribe();
  return ()=>supabase.removeChannel(channel);
}
