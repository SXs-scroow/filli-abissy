import { nextStamp, observePlayerStamps } from './stampClock.js';
import { playerStoreEnabled, fetchPlayers as fetchPlayerRows, fetchPlayersByIds, upsertPlayers, upsertPlayerTombstones, subscribePlayers } from './playerStore.js';

const host={};
let clone,storageGet,storageSet,KEY,serializeState,sameGlobalValue,normalize,imageValue,persistCriticalCache,persistSessionCache,refreshMasterPlayersAdminView,cryptoRandomId;
export function initPlayers(deps){
  ({clone,storageGet,storageSet,KEY,serializeState,sameGlobalValue,normalize,imageValue,persistCriticalCache,persistSessionCache,refreshMasterPlayersAdminView,cryptoRandomId}=deps);
  Object.defineProperty(host,'state',{get:deps.getState,configurable:true});
}

export const ps={
  timer:null,hydrated:false,applying:false,hydrating:false,hydratePromise:null,lastSyncAt:0,
  unsubscribe:null,syncBusy:false,syncPromise:null,
  circuitOpen:false,
  readOnly:false,
  lastSnapshot:[]
};
const PLAYER_ROSTER_CACHE_KEY='a_profecia_server_roster_v1';
function saveConfirmedPlayerRoster(rows){
  if(host.state.session?.role!=='master'||!Array.isArray(rows))return;
  try{
    const deleted={};
    for(const r of rows){
      if(r?.id&&r?.deleted_at){
        const when=Date.parse(r.deleted_at)||Number(r?.data?._syncUpdatedAt)||nextStamp();
        deleted[String(r.id)]=when;
      }
    }
    const active=rows.filter(r=>r&&r.id&&!r.deleted_at).map(r=>({id:String(r.id),login:String(r.login||''),data:clone(r.data||{}),updated_at:r.updated_at||null}));
    storageSet(PLAYER_ROSTER_CACHE_KEY,JSON.stringify({version:2,savedAt:Date.now(),rows:active,deleted}));
  }catch{}
}
function loadConfirmedPlayerRoster(){
  try{
    const raw=storageGet(PLAYER_ROSTER_CACHE_KEY);
    const parsed=raw?JSON.parse(raw):null;
    const rows=Array.isArray(parsed?.rows)?parsed.rows:[];
    const deleted=parsed?.deleted&&typeof parsed.deleted==='object'?parsed.deleted:{};
    return rows.filter(r=>{const id=String(r?.id||'');return id&&!deleted[id]});
  }catch{return []}
}
function applyConfirmedPlayerRosterFallback(){
  if(host.state.session?.role!=='master')return false;
  const rows=loadConfirmedPlayerRoster();
  if(!rows.length){host.state.players=[];ps.lastSnapshot=[];return false}
  ps.applying=true;
  try{applyPlayerRows(rows,{initial:true,authoritative:true});}
  finally{ps.applying=false}
  ps.readOnly=true;
  storageSet(KEY,serializeState());
  return true;
}
function isEmptySheetValue(value){
  if(value===undefined||value===null||value==='')return true;
  if(Array.isArray(value))return value.length===0;
  if(typeof value==='object')return Object.keys(value).length===0||Object.values(value).every(v=>v===undefined||v===null||v===''||v===0||v===false||(Array.isArray(v)&&v.length===0));
  return false;
}
function preserveLocalSheetAgainstReset(remoteData,localPlayer){
  if(!remoteData||!localPlayer)return false;
  const skip=new Set(['id','login','password','newPassword','secretLovedEffect','secretClues','rolls','_syncUpdatedAt','_pointsAt','_keyAt','_pendingCreate']);
  const localKeys=localPlayer._keyAt&&typeof localPlayer._keyAt==='object'?localPlayer._keyAt:{};
  const remoteKeys=remoteData._keyAt&&typeof remoteData._keyAt==='object'?remoteData._keyAt:{};
  let kept=false;
  for(const key of Object.keys(localPlayer)){
    if(skip.has(key)||key.startsWith('_'))continue;
    if((key==='attrs'||key==='skills')&&(Number(remoteData._pointsAt)||0)>(Number(localPlayer._pointsAt)||0))continue;
    const localValue=localPlayer[key],remoteValue=remoteData[key];
    if(isEmptySheetValue(localValue)||!isEmptySheetValue(remoteValue))continue;
    if((Number(remoteKeys[key])||0)>(Number(localKeys[key])||0))continue;
    remoteData[key]=clone(localValue);
    kept=true;
  }
  return kept;
}
function keepNewerLocalPoints(remoteData,localPlayer){
  const SKIP=new Set(['attrs','skills','rolls','secretClues','password','newPassword','secretLovedEffect','id','login']);
  if(!remoteData||!localPlayer)return false;
  let kept=false;
  const lp=Number(localPlayer._pointsAt)||0,rp=Number(remoteData._pointsAt)||0;
  if(lp>rp){remoteData.attrs=clone(localPlayer.attrs||{});remoteData.skills=clone(localPlayer.skills||{});remoteData._pointsAt=lp;kept=true}
  const lk=localPlayer._keyAt;
  if(lk&&typeof lk==='object'){
    const rk=remoteData._keyAt&&typeof remoteData._keyAt==='object'?{...remoteData._keyAt}:{};
    const isPlayer=host.state?.session?.role==='player';
    for(const k of Object.keys(lk)){
      if(SKIP.has(k)||k.startsWith('_'))continue;
      if(isPlayer&&(k==='masterNotes'||k==='attrBonusPoints'||k==='skillBonusPoints'))continue;
      const ls=Number(lk[k])||0;
      if(ls>(Number(rk[k])||0)){
        if(k in localPlayer)remoteData[k]=clone(localPlayer[k]);else delete remoteData[k];
        rk[k]=ls;kept=true;
      }
    }
    if(kept)remoteData._keyAt=rk;
  }
  return kept;
}
function adoptPlayerInPlace(localObj,next){
  if(!localObj||localObj===next)return next;
  for(const k of Object.keys(localObj))delete localObj[k];
  Object.assign(localObj,next);
  return localObj;
}
function playerSyncKey(p){return String(p?.id||p?.login||'').trim()}
const PLAYER_KEY_SKIP=new Set(['attrs','skills','rolls','secretClues','password','newPassword','secretLovedEffect','id','login']);
function markLocalPlayerChanges(){
  host.state.playerTombstones=host.state.playerTombstones&&typeof host.state.playerTombstones==='object'?host.state.playerTombstones:{};
  const previous=new Map((ps.lastSnapshot||[]).map(p=>[playerSyncKey(p),p]));
  const current=new Map((host.state.players||[]).map(p=>[playerSyncKey(p),p]));
  observePlayerStamps(host.state.players);
  const now=nextStamp();
  for(const [key,p] of current){
    if(!key)continue;
    const tomb=Number(host.state.playerTombstones[key])||0;
    if(tomb)continue;
    const old=previous.get(key);
    if(!old||!sameGlobalValue({...old,_syncUpdatedAt:0},{...p,_syncUpdatedAt:0})) p._syncUpdatedAt=Math.max(Number(p._syncUpdatedAt)||0,now);
    if(old&&!sameGlobalValue({a:old.attrs,s:old.skills},{a:p.attrs,s:p.skills})) p._pointsAt=Math.max((Number(p._pointsAt)||0)+1,now);
    if(old){
      const ks=p._keyAt&&typeof p._keyAt==='object'&&!Array.isArray(p._keyAt)?{...p._keyAt}:{};let kc=false;
      for(const k of new Set([...Object.keys(p),...Object.keys(old)])){
        if(PLAYER_KEY_SKIP.has(k)||k.startsWith('_'))continue;
        if(!sameGlobalValue(old[k],p[k])){ks[k]=Math.max((Number(ks[k])||0)+1,now);kc=true}
      }
      if(kc)p._keyAt=ks;
    }
  }
  for(const [key,old] of previous){
    if(key&&!current.has(key)) host.state.playerTombstones[key]=Math.max(Number(host.state.playerTombstones[key])||0,Number(old?._syncUpdatedAt)||now);
  }
  ps.lastSnapshot=clone(host.state.players||[]);
}
function mergePlayersRemote(remotePlayers,remoteTombstones){
  observePlayerStamps(remotePlayers);
  const local=Array.isArray(host.state.players)?host.state.players:[];
  const remote=Array.isArray(remotePlayers)?remotePlayers:[];
  const merged=new Map();
  for(const p of local){const k=playerSyncKey(p);if(k)merged.set(k,clone(p));}
  for(const p of remote){
    const k=playerSyncKey(p);if(!k)continue;
    if(p?.deleted_at){merged.delete(k);continue}
    const l=merged.get(k);
    if(!l){merged.set(k,clone(p));continue}
    const lt=Number(l._syncUpdatedAt)||0,rt=Number(p._syncUpdatedAt)||0;
    if(rt>=lt){const np=clone(p);if(keepNewerLocalPoints(np,l)){np._syncUpdatedAt=nextStamp()}merged.set(k,np)}
  }
  const tomb={...(host.state.playerTombstones||{})};
  for(const [k,v] of Object.entries(remoteTombstones||{}))
    tomb[k]=Math.max(Number(tomb[k])||0,Number(v)||0);
  for(const k of Object.keys(tomb)) merged.delete(k);
  const before=JSON.stringify(host.state.players||[]);
  host.state.players=[...merged.values()];
  host.state.playerTombstones=tomb;
  host.state.players.forEach(normalize);
  ps.lastSnapshot=clone(host.state.players);
  return before!==JSON.stringify(host.state.players);
}
function playerRowStamp(row){return Math.max(Date.parse(row?.updated_at||'')||0,Number(row?.data?._syncUpdatedAt)||0)}
function playerRowDeletedStamp(row){const raw=row?.deleted_at;if(raw===true||String(raw||'').trim().toLowerCase()==='deleted')return nextStamp();return Date.parse(raw||'')||0}
async function fetchPlayerRowsConfirmed(ids=null){
  const targeted=Array.isArray(ids)?[...new Set(ids.map(id=>String(id||'').trim()).filter(Boolean))].slice(0,50):null;
  const read=()=>targeted?.length?fetchPlayersByIds(targeted):fetchPlayerRows();
  const first=await read();
  observePlayerStamps(first);
  if(first.length)return first;
  await new Promise(r=>setTimeout(r,600));
  const second=await read();observePlayerStamps(second);return second;
}
function applyPlayerRows(rows,{initial=false,authoritative=false}={}){
  observePlayerStamps(rows);
  const beforeState=JSON.stringify(host.state.players||[]);
  const beforeTombstones=JSON.stringify(host.state.playerTombstones||{});
  const local=Array.isArray(host.state.players)?host.state.players:[];
  const byId=new Map(local.map(p=>[playerSyncKey(p),p]));
  const tomb={...(host.state.playerTombstones||{})};
  let pointsNeedPush=false;
  for(const row of (Array.isArray(rows)?rows:[])){
    const key=String(row?.id||'').trim(); if(!key)continue;
    const stamp=playerRowStamp(row), deleted=playerRowDeletedStamp(row);
    const localPlayer=byId.get(key), localStamp=Number(localPlayer?._syncUpdatedAt)||0;
    if(deleted){
      byId.delete(key);
      tomb[key]=Math.max(Number(tomb[key])||0,deleted);
      continue;
    }
    if(row?.data&&typeof row.data==='object'&&(!localPlayer||stamp>localStamp)){
      const p=clone(row.data);
      let rowNeedsPush=false;
      if(localPlayer){
        for(const k of ['photo','soulPhoto','homeWallpaper'])if(!imageValue(p[k])&&imageValue(localPlayer[k]))p[k]=localPlayer[k];
        p.rolls=mergeRollHistory(p.rolls||[],localPlayer.rolls||[]);
        p.secretClues=mergeSecretClues(p.secretClues,localPlayer.secretClues);
        if(preserveLocalSheetAgainstReset(p,localPlayer))rowNeedsPush=true;
        if(keepNewerLocalPoints(p,localPlayer))rowNeedsPush=true;
        if(rowNeedsPush){p._syncUpdatedAt=nextStamp();pointsNeedPush=true}
      }
      p._syncUpdatedAt=Math.max(Number(p._syncUpdatedAt)||0,stamp);byId.set(key,localPlayer?adoptPlayerInPlace(localPlayer,p):p);delete tomb[key];
    }else if(localPlayer&&row?.data&&typeof row.data==='object'&&Array.isArray(row.data.secretClues)&&row.data.secretClues.length){
      const merged=mergeSecretClues(localPlayer.secretClues,row.data.secretClues);
      if(merged.length!==(Array.isArray(localPlayer.secretClues)?localPlayer.secretClues.length:0))localPlayer.secretClues=merged;
    }
  }
  if(authoritative&&host.state.session?.role==='master' && playerStoreEnabled && Array.isArray(rows)){
    const remoteIds=new Set(rows.map(r=>String(r?.id||'').trim()).filter(Boolean));
    for(const [key,p] of [...byId.entries()]){
      if(!remoteIds.has(key) && !p?._pendingCreate)byId.delete(key);
    }
  }else if(authoritative&&host.state.session?.role==='player' && playerStoreEnabled && Array.isArray(rows)){
    const activeId=String(host.state.session?.playerId||'').trim();
    const remoteIds=new Set(rows.map(r=>String(r?.id||'').trim()).filter(Boolean));
    for(const [key] of [...byId.entries()]){
      if(key&&key!==activeId&&!remoteIds.has(key))byId.delete(key);
    }
  }
  for(const [key,t] of Object.entries(tomb)){
    const p=byId.get(key);if(p&&Number(t)>=(Number(p._syncUpdatedAt)||0)){byId.delete(key)}
  }
  host.state.players=[...byId.values()];
  host.state.players.forEach(normalize);
  host.state.playerTombstones=tomb;
  ps.lastSnapshot=clone(host.state.players);
  const changed=beforeState!==JSON.stringify(host.state.players||[]) || beforeTombstones!==JSON.stringify(host.state.playerTombstones||{});
  if(pointsNeedPush){try{queuePlayerDbSave()}catch{}}
  return {changed,empty:!rows?.length&&initial};
}
async function hydratePlayersDb(){
  if(!playerStoreEnabled)return;
  if(ps.hydrating)return ps.hydratePromise||false;
  ps.hydrating=true;
  ps.hydratePromise=(async()=>{
  try{
    const hydratePlayerId=host.state.session?.role==='player'?String(host.state.session?.playerId||'').trim():'';
    const rows=await fetchPlayerRowsConfirmed(hydratePlayerId?[hydratePlayerId]:null);
    ps.readOnly=false;
    ps.lastSyncAt=Date.now();
    saveConfirmedPlayerRoster(rows);
    if(rows.length){
      ps.applying=true;
      applyPlayerRows(rows,{initial:true,authoritative:true});
      ps.applying=false;
      persistCriticalCache();persistSessionCache();storageSet(KEY,serializeState());
    }else{
      const migrationKey='a_profecia_players_legacy_migrated_v2';
      const migrated=storageGet(migrationKey)==='1';
      const tomb=host.state.playerTombstones&&typeof host.state.playerTombstones==='object'?host.state.playerTombstones:{};
      if(!migrated && host.state.session?.role==='master'){
        const list=(Array.isArray(host.state.players)?host.state.players:[]).filter(p=>{
          const k=playerSyncKey(p);return k&&!tomb[k]&&p?._pendingCreate===true;
        });
        if(list.length){
          list.forEach(p=>{if(!p._syncUpdatedAt)p._syncUpdatedAt=nextStamp()});
          await upsertPlayers(list);
          list.forEach(p=>{delete p._pendingCreate});
        }
        storageSet(migrationKey,'1');
      }
      const isMaster=host.state.session?.role==='master';
      if(isMaster){
        const keep=new Map();
        for(const p of (host.state.players||[])){
          const k=playerSyncKey(p);
          if(!k||tomb[k])continue;
          if(p?._pendingCreate)keep.set(k,p);
        }
        host.state.players=[...keep.values()];
        ps.lastSnapshot=clone(host.state.players);
        storageSet(KEY,serializeState());
      }
    }
    ps.hydrated=true;
  }catch(e){
    ps.readOnly=true;
    if(host.state.session?.role==='master')applyConfirmedPlayerRosterFallback();
    ps.hydrated=true;
    console.warn('Banco de Players indisponível; usando somente o último roster confirmado pelo servidor.',e);
  }
  finally{ps.hydrating=false;ps.hydratePromise=null}
  })();
  return ps.hydratePromise;
}
async function syncPlayersDbNow(manual=false,{fresh=false}={}){
  if(!playerStoreEnabled||!ps.hydrated||ps.applying)return false;
  if(ps.circuitOpen&&!manual)return false;
  if(manual)ps.circuitOpen=false;
  if(typeof navigator!=='undefined'&&navigator.onLine===false){ps.readOnly=true;return false;}
  if(ps.syncBusy){
    if(!(fresh||manual))return ps.syncPromise||false;
    try{await ps.syncPromise}catch{}
    if(ps.syncBusy)return ps.syncPromise||false;
  }
  ps.syncBusy=true;
  ps.syncPromise=(async()=>{try{
    const beforeRoster=JSON.stringify(host.state.players||[]);
    const syncRole=host.state.session?.role;
    const syncActiveId=String(host.state.session?.playerId||'');
    const rows=await fetchPlayerRowsConfirmed(syncRole==='player'&&syncActiveId?[syncActiveId]:null);
    ps.readOnly=false;
    ps.lastSyncAt=Date.now();
    saveConfirmedPlayerRoster(rows);
    const remoteById=new Map(rows.map(r=>[String(r.id),r]));
    const localById=new Map((host.state.players||[]).map(p=>[playerSyncKey(p),p]));
    const startKeys=new Set(localById.keys());
    const confirmedDeletedKeys=new Set();

    for(const row of rows){
      const k=String(row?.id||'').trim(); if(!k)continue;
      const remoteStamp=playerRowStamp(row);
      if(row?.deleted_at){
        confirmedDeletedKeys.add(k);
        host.state.playerTombstones=host.state.playerTombstones||{};
        host.state.playerTombstones[k]=Math.max(Number(host.state.playerTombstones[k])||0,playerRowDeletedStamp(row)||remoteStamp||nextStamp());
        localById.delete(k);
        continue;
      }
      const existing=localById.get(k);
      const tomb=Number(host.state.playerTombstones?.[k])||0;
      if(tomb && tomb>=remoteStamp) { localById.delete(k); continue; }
      if(!existing && row?.data&&typeof row.data==='object'){
        const incoming=clone(row.data);
        incoming._syncUpdatedAt=Math.max(Number(incoming._syncUpdatedAt)||0,remoteStamp);
        normalize(incoming);
        localById.set(k,incoming);
      }else if(existing && row?.data&&typeof row.data==='object' && remoteStamp>(Number(existing._syncUpdatedAt)||0)){
        const incoming=clone(row.data);
        incoming._syncUpdatedAt=Math.max(Number(incoming._syncUpdatedAt)||0,remoteStamp);
        for(const key of ['photo','soulPhoto','homeWallpaper'])if(!imageValue(incoming[key])&&imageValue(existing[key]))incoming[key]=existing[key];
        incoming.rolls=mergeRollHistory(incoming.rolls||[],existing.rolls||[]);
        if(keepNewerLocalPoints(incoming,existing))incoming._syncUpdatedAt=nextStamp();
        normalize(incoming);
        localById.set(k,adoptPlayerInPlace(existing,incoming));
      }
    }
    const toUpsert=[];
    for(const p of [...localById.values()]){
      const k=playerSyncKey(p); if(!k)continue;
      const localTomb=Number(host.state.playerTombstones?.[k])||0;
      if(localTomb){ localById.delete(k); continue; }
      const remote=remoteById.get(k), localStamp=Number(p._syncUpdatedAt)||0, remoteStamp=playerRowStamp(remote);
      if(remote?.deleted_at){
        confirmedDeletedKeys.add(k);
        localById.delete(k);
        host.state.playerTombstones=host.state.playerTombstones||{};
        host.state.playerTombstones[k]=Math.max(Number(host.state.playerTombstones[k])||0,remoteStamp||nextStamp());
      }else if(!remote){
        const tomb=Number(host.state.playerTombstones?.[k])||0;
        if(tomb){localById.delete(k);continue;}
        if(syncRole==='player'){
          if(k!==syncActiveId)localById.delete(k);
          continue;
        }
        if(syncRole==='master'&&p._pendingCreate){p._syncUpdatedAt=localStamp||nextStamp();toUpsert.push(p);continue}
        localById.delete(k);
        if(syncRole==='master')continue;
        p._syncUpdatedAt=localStamp||nextStamp();
        toUpsert.push(p);
      }else if(remote.data){
        const rp=clone(remote.data);rp._syncUpdatedAt=Math.max(Number(rp._syncUpdatedAt)||0,remoteStamp);
        const localComparable=clone({...p,_syncUpdatedAt:0});
        const remoteComparable=clone({...rp,_syncUpdatedAt:0});
        if(localStamp>remoteStamp && !sameGlobalValue(localComparable,remoteComparable)){
          p._syncUpdatedAt=localStamp||nextStamp();
          toUpsert.push(p);
        }else if(localStamp===remoteStamp && !sameGlobalValue(localComparable,remoteComparable)){
          p._syncUpdatedAt=nextStamp();
          toUpsert.push(p);
        }else if(remoteStamp>localStamp){
          let changed=false;
          if(Array.isArray(p.rolls)&&p.rolls.length){
            const mergedRolls=mergeRollHistory(rp.rolls||[],p.rolls);
            if(JSON.stringify(mergedRolls)!==JSON.stringify(rp.rolls||[])){rp.rolls=mergedRolls;changed=true;}
          }
          for(const key of ['photo','soulPhoto','homeWallpaper'])if(!imageValue(rp[key])&&imageValue(p[key])){rp[key]=p[key];changed=true;}
          if(keepNewerLocalPoints(rp,p))changed=true;
          if(changed){rp._syncUpdatedAt=nextStamp();const kept=adoptPlayerInPlace(p,rp);localById.set(k,kept);toUpsert.push(kept)}
          else localById.set(k,adoptPlayerInPlace(p,rp));
        }
      }
    }
    const canWriteRow=k=>syncRole==='master'||(syncRole==='player'&&!!syncActiveId&&String(k)===syncActiveId);
    const writable=toUpsert.filter(x=>canWriteRow(playerSyncKey(x)));
    if(writable.length){
      await upsertPlayers(writable);
      for(const p of writable)delete p._pendingCreate;
    }
    if(host.state.session?.role==='master'){
      const pendingDeletes={};
      for(const [k,t] of Object.entries(host.state.playerTombstones||{})){
        const key=String(k||'').trim();
        if(key&&Number(t)>0)pendingDeletes[key]=Number(t);
      }
      if(Object.keys(pendingDeletes).length)await upsertPlayerTombstones(pendingDeletes);
    }
    const before=JSON.stringify(host.state.players||[]);
    {
      const cur=new Map((host.state.players||[]).map(p=>[playerSyncKey(p),p]));
      const merged=new Map();
      for(const [k,p] of localById){
        const c=cur.get(k);
        if(!c){if(!startKeys.has(k))merged.set(k,p);continue}
        merged.set(k,(Number(c._syncUpdatedAt)||0)>=(Number(p._syncUpdatedAt)||0)?c:p);
      }
      for(const [k,c] of cur){if(confirmedDeletedKeys.has(k))continue;if(!merged.has(k)&&!startKeys.has(k))merged.set(k,c)}
      for(const [k,tm] of Object.entries(host.state.playerTombstones||{})){const p=merged.get(k);if(p&&Number(tm)>=(Number(p._syncUpdatedAt)||0))merged.delete(k)}
      host.state.players=[...merged.values()];
    }
    host.state.players.forEach(normalize);ps.lastSnapshot=clone(host.state.players);
    const rosterChanged=before!==JSON.stringify(host.state.players||[]) || beforeRoster!==JSON.stringify(host.state.players||[]);
    if(rosterChanged)storageSet(KEY,serializeState());
    if(rosterChanged)refreshMasterPlayersAdminView();
    return true;
  }catch(e){
    const msg=String(e?.message||e||'');
    const normalized=msg.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').toUpperCase();
    if(/SESSAO_INVALIDA|P0001.*SESSAO_INVALIDA/.test(normalized)){
      ps.readOnly=true;
      console.warn('Sessão do navegador não foi aceita pelo servidor; sincronização pausada até novo login.');
      return false;
    }
    ps.readOnly=true;
    console.warn('Falha ao sincronizar Players; modo somente-leitura ativado:',e);
    return false
  }
  finally{ps.syncBusy=false;ps.syncPromise=null}})();
  return ps.syncPromise;
}
function queuePlayerDbSave(){
  if(!playerStoreEnabled||!ps.hydrated||ps.applying)return;
  clearTimeout(ps.timer);ps.timer=setTimeout(()=>syncPlayersDbNow().catch(()=>{}),700);
}
async function reconcilePlayersStability(){
  if(ps.circuitOpen)return;
  if(!playerStoreEnabled||!ps.hydrated||ps.applying||document.hidden)return;
  try{
    await syncPlayersDbNow();
  }catch(error){
    if(!/SESSAO_INVALIDA/.test(String(error?.message||''))) console.warn('Reconciliação de Players falhou:',error);
  }
}
function mergeSecretClues(...lists){
  const seen=new Set(),out=[];
  for(const list of lists){
    for(const c of (Array.isArray(list)?list:[])){
      if(!c||typeof c!=='object')continue;
      const id=String(c.id||'');if(!id||seen.has(id))continue;
      seen.add(id);out.push(c);
    }
  }
  return out.sort((x,y)=>(Number(y.receivedAt)||0)-(Number(x.receivedAt)||0)).slice(0,200);
}
function mergeRollHistory(existing, ...incoming){
  const list=Array.isArray(existing)?existing:[];
  const all=[...list,...incoming.flatMap(x=>Array.isArray(x)?x:[x])].filter(Boolean);
  const seen=new Set(), unique=[];
  for(const r of all){
    const id=String(r.id||'');
    const key=id||`${r.createdAt||''}|${r.time||''}|${r.die||r.label||''}|${r.value}|${JSON.stringify(r.rawRolls||[])}`;
    if(seen.has(key))continue;
    seen.add(key);unique.push({...r,id:id||cryptoRandomId('roll')});
  }
  unique.sort((x,y)=>(Number(x.createdAt)||0)-(Number(y.createdAt)||0));
  return unique.slice(-30);
}

export {
  PLAYER_ROSTER_CACHE_KEY,playerSyncKey,markLocalPlayerChanges,mergePlayersRemote,playerRowDeletedStamp,
  fetchPlayerRowsConfirmed,applyPlayerRows,hydratePlayersDb,syncPlayersDbNow,queuePlayerDbSave,
  reconcilePlayersStability,mergeRollHistory
};
