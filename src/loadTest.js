import { mergePlayerQueueItems, serializePlayerQueue } from './persistence/playerQueue.js';
import { runDeploymentCacheCheck } from './version/deploymentDiagnostics.js';
import { classifyPerformanceSnapshot, collectPerformanceSnapshot, runResponsivenessProbe } from './performance/performanceDiagnostics.js';

/**
 * Laboratório de carga do Ashen Testimony.
 *
 * Este módulo é isolado do ciclo normal de persistência: a simulação trabalha em
 * cópias de estado e o teste remoto só faz leituras autenticadas, nunca grava fichas.
 * As dependências entram por parâmetro para que os testes possam reproduzir a lógica
 * real do sincronizador sem criar acoplamento circular com app.js.
 */
export function loadAdmin(version = 'V1.5.56'){
  const report=typeof window!=='undefined'?(window.__aProfeciaStressReport||null):null;
  const status=report?({passed:'Último teste: PASSOU',partial:'Último teste: PARCIAL',inconclusive:'Último teste: INCONCLUSIVO',failed:'Último teste: FALHOU'}[report.status]||'Ainda não executado'):'Ainda não foi executado nenhum teste nesta sessão.';
  const latency=report?.serverLatency||{};
  const details=report?`Último resultado: ${report.status.toUpperCase()} • alvo ${report.virtualClients||15} clientes • ${report.serverReads||0} leituras concluídas • p50 ${latency.p50??'—'} ms • p95 ${latency.p95??'—'} ms • pico simultâneo ${report.serverMaxInFlight||0} • ${report.elapsed||0} ms • ${report.at?new Date(report.at).toLocaleString('pt-BR'):''}`:'O teste local simula concorrência e convergência; a parte de servidor faz apenas leituras autenticadas e não grava nem altera fichas reais.';
  const persistence=typeof window!=='undefined'?(window.__aProfeciaPersistenceReport||null):null;
  const pStatus=persistence?(persistence.ok?'Última verificação da fila: PASSOU':'Última verificação da fila: FALHOU'):'Verificação da fila ainda não executada.';
  const pDetails=persistence?`${persistence.checksPassed}/${persistence.checksTotal} verificações • ${persistence.at?new Date(persistence.at).toLocaleString('pt-BR'):''}${persistence.problems?.length?` • ${persistence.problems.join(' | ')}`:''}`:'Usa fichas artificiais para testar remoção de senhas, recuperação após serialização e preservação de itens pendentes. Não altera o armazenamento real.';
  const syncReport=typeof window!=='undefined'?(window.__aProfeciaSyncCheck||null):null;
  return `<section class="card load-lab-card"><span class="badge">CENTRAL DE TESTES ISOLADA</span><p class="tiny muted">${version}</p><h2>Sincronização, persistência e capacidade</h2><p class="tiny muted">Meta de capacidade — 15 pessoas simultâneas</p><p>Use esta área para executar testes separados antes de uma sessão. Os testes artificiais não modificam fichas reais; a verificação de sincronização real é identificada e pede confirmação antes de rodar.</p><div class="load-lab-targets"><div><small>CLIENTES VIRTUAIS</small><strong>15 / 20 / 30 / 50 / 100</strong><span>convergência local</span></div><div><small>PERSISTÊNCIA</small><strong>Fila + recuperação</strong><span>segredos filtrados</span></div><div><small>CARGA REMOTA</small><strong>15 leituras concorrentes</strong><span>somente leitura</span></div></div><h3>1. Persistência e segurança da fila</h3><p id="playerPersistenceStatus" class="load-lab-status">${pStatus}</p><p id="playerPersistenceDetails" class="small muted">${pDetails}</p><button class="btn" id="runPersistenceSelfTest">🔒 Testar persistência sem dados reais</button><h3>2. Sincronização real da sessão</h3><p id="playerSyncCheckStatus" class="load-lab-status">${syncReport?.message||'Ainda não executada nesta sessão.'}</p><button class="btn" id="runPlayerSyncCheck">🔄 Verificar sincronização real</button><p class="tiny muted">Esta opção usa a sessão autenticada e executa a sincronização normal do site. Confirme antes de rodar; ela pode enviar alterações locais pendentes para o servidor.</p><h3>3. Teste simultâneo</h3><p id="playerStressStatus" class="load-lab-status">${status}</p><p id="playerStressDetails" class="small muted">${details}</p><button class="btn primary" id="runPlayerStressTest">🧪 Testar 15 pessoas simultâneas</button><p class="tiny muted">O teste usa 15 clientes virtuais como meta mínima, escala a simulação local para 20/30/50/100 e dispara até 15 leituras autenticadas concorrentes. É uma sonda somente de leitura: não simula gravações reais nem comprova, sozinha, 15 usuários reais ponta a ponta.</p><h3>4. Inicialização, versão e cache</h3><p id="deploymentCacheStatus" class="load-lab-status">${typeof window!=='undefined'&&window.__aProfeciaDeploymentReport?(window.__aProfeciaDeploymentReport.ok?'Última verificação: PASSOU':'Última verificação: ATENÇÃO'):'Verificação de cache ainda não executada.'}</p><p id="deploymentCacheDetails" class="small muted">${typeof window!=='undefined'&&window.__aProfeciaDeploymentReport?window.__aProfeciaDeploymentReport.checks.map(c=>`${c.ok?'OK':'VERIFICAR'} — ${c.name}${c.detail?`: ${c.detail}`:''}`).join(' • '):'Consulta o HTML publicado sem cache, confere os cabeçalhos e identifica a compilação carregada. É somente leitura.'}</p><button class="btn" id="runDeploymentCacheCheck">🔎 Verificar versão e cache</button><p class="tiny muted">Este diagnóstico não limpa o armazenamento nem recarrega a página; ele apenas verifica a resposta atual do site. Se detectar um service worker ativo ou cabeçalhos incorretos, investigue antes de concluir.</p><h3>5. Desempenho local, memória e carregamento</h3><p id="performanceStatus" class="load-lab-status">${typeof window!=='undefined'&&window.__ashenPerformanceReport?'Última medição disponível.':'Medição ainda não executada nesta sessão.'}</p><pre id="performanceDetails" class="small muted">${typeof window!=='undefined'&&window.__ashenPerformanceReport?JSON.stringify(window.__ashenPerformanceReport,null,2):'Mede recursos, tempo de carregamento, elementos DOM, heap quando disponível e tarefas longas capturadas desde a abertura. É um diagnóstico local, não um teste de servidor.'}</pre><div class="row-actions"><button class="btn" id="runPerformanceDiagnostics">📊 Medir desempenho local</button><button class="btn" id="exportPerformanceReport">⬇️ Exportar relatório JSON</button></div><p class="tiny muted">Não altera fichas, cache, sincronização ou configurações. Heap e Long Tasks dependem do suporte do navegador; medições variam com cache, dispositivo e conexão. Rode uma vez após abrir e outra após navegar pelas telas usadas na sessão.</p></section>`;
}


function summarizeLatency(values=[]){
  const sorted=[...values].sort((a,b)=>a-b);
  return {samples:sorted.length,p50:sorted.length?sorted[Math.floor((sorted.length-1)*0.50)]:0,p95:sorted.length?sorted[Math.ceil(sorted.length*0.95)-1]:0,max:sorted.length?sorted[sorted.length-1]:0};
}

export function simulateRosterConvergence(deps, n=20, cycles=3){
  const { state, ps, applyPlayerRows, clone } = deps;
  const problems=[];
  const savedPlayers=state.players,savedTomb=state.playerTombstones,savedSnap=ps.lastSnapshot;
  const pid=i=>`stress-${i}`;
  const truth=Array.from({length:n},(_,i)=>({id:pid(i+1),login:pid(i+1),name:`Stress Player ${i+1}`,campaignType:'campaign',attrs:{Corpo:2,Sanidade:2},skills:{},attrLimits:{},hp:10,hpMax:18,sanity:18,sanityMax:18,conditions:[],conditionTurns:{},conditionTick:{},backpack:[],secretClues:[],rolls:[],_syncUpdatedAt:1000}));
  const toRow=(p,stamp,deleted=false)=>({id:p.id,login:p.login,data:{...clone(p),_syncUpdatedAt:stamp},updated_at:new Date(stamp).toISOString(),deleted_at:deleted?new Date(stamp).toISOString():null});
  const clients=Array.from({length:n},()=>{const players=truth.map(p=>clone(p));return {players,tomb:{},snapshot:clone(players)}});
  // Aparelho 4 com relógio adiantado: a ficha local "parece" mais nova que a do servidor (vida 3 só existe nele).
  const SKEW=3;clients[SKEW].players[SKEW]={...clients[SKEW].players[SKEW],hp:3,_syncUpdatedAt:9e12};
  const apply=(c,rows)=>{state.players=c.players;state.playerTombstones=c.tomb;ps.lastSnapshot=c.snapshot;try{applyPlayerRows(rows,{authoritative:false})}finally{c.players=state.players;c.tomb=state.playerTombstones;c.snapshot=ps.lastSnapshot}};
  try{
    let t=2000;
    for(let cy=0;cy<cycles;cy++){
      t+=1000;
      truth.forEach((p,i)=>{p.hp=Math.max(4,9-cy);p.secretClues.unshift({id:`clue-${cy}-${i}`,title:'Teste',message:'Teste',receivedAt:t})});
      const rows=truth.map(p=>toRow(p,t));
      clients.forEach((c,ci)=>{
        // Cada aparelho recebe numa ordem diferente e o evento chega duplicado (o Realtime costuma repetir).
        const k=(ci+cy)%rows.length,order=rows.slice(k).concat(rows.slice(0,k));
        apply(c,order);apply(c,order);
      });
    }
    const stale=toRow({...truth[0],hp:99},1500); // resposta atrasada: nunca pode sobrescrever a ficha mais nova
    clients.forEach(c=>apply(c,[stale]));
    const del=toRow(truth[n-1],t+1000,true);      // exclusão confirmada pelo servidor
    clients.forEach(c=>apply(c,[del]));
    const finalHp=Math.max(4,9-(cycles-1));
    clients.forEach((c,ci)=>{
      const byId=new Map(c.players.map(p=>[p.id,p]));
      if(byId.has(pid(n)))problems.push(`aparelho ${ci+1}: ficha excluída continuou existindo`);
      if(c.players.length!==n-1)problems.push(`aparelho ${ci+1}: esperado ${n-1} fichas, ficou com ${c.players.length}`);
      for(let i=1;i<n;i++){
        const p=byId.get(pid(i));
        if(!p){problems.push(`aparelho ${ci+1}: ficha ${i} sumiu`);continue}
        const clues=Array.isArray(p.secretClues)?p.secretClues:[];
        if(new Set(clues.map(x=>x.id)).size!==cycles||clues.length!==cycles)problems.push(`aparelho ${ci+1}: ficha ${i} com ${clues.length} pistas (esperado ${cycles})`);
        const want=(ci===SKEW&&i===SKEW+1)?3:finalHp;
        if(p.hp!==want)problems.push(`aparelho ${ci+1}: ficha ${i} com vida ${p.hp} (esperado ${want})`);
      }
    });
  }catch(error){problems.push(`erro na simulação: ${String(error?.message||error)}`)}
  finally{state.players=savedPlayers;state.playerTombstones=savedTomb;ps.lastSnapshot=savedSnap}
  return {ok:!problems.length,problems:problems.slice(0,5),total:problems.length};
}

export async function runPlayerStressTest(deps){
  const { version, state, ps, applyPlayerRows, clone, playerStoreEnabled, getAuthToken, fetchPlayersByIds, toast = () => {} } = deps || {};
  const button=document.getElementById('runPlayerStressTest');
  const status=document.getElementById('playerStressStatus');
  const details=document.getElementById('playerStressDetails');
  if(!button)return;
  const set=(el,t)=>{if(el)el.textContent=t};
  button.disabled=true; const old=button.textContent; button.textContent='⏳ Testando...';
  set(status,`Executando simulação de sincronização (${version})...`); set(details,'Não mexe nas fichas reais.');
  const started=performance.now(); const virtualClients=15; const cycles=3;
  let sim={ok:false,problems:[],total:0}, serverReads=0, serverFailures=0, distinctIds=0, skipReason='', serverInFlight=0, serverMaxInFlight=0;
  const serverLatencyMs=[];
  const scaleTests=[];
  const serverMismatch=[];
  const log=(type,message)=>{try{window.__aProfeciaMaintenance?.events?.push({time:new Date().toISOString(),type,message})}catch{}};
  try{
    // 1) Simulação local com o applyPlayerRows real (ordem embaralhada, eventos duplicados, relógio adiantado, exclusão).
    sim=simulateRosterConvergence({state,ps,applyPlayerRows,clone},virtualClients,cycles);
    // 1b) Escala local progressiva: valida a lógica com rosters maiores sem tocar no servidor.
    for(const clients of [15,20,30,50,100]){
      const scaleStarted=performance.now();
      const result=simulateRosterConvergence({state,ps,applyPlayerRows,clone},clients,cycles);
      scaleTests.push({clients,ok:result.ok,total:result.total,elapsed:Math.round(performance.now()-scaleStarted),problems:result.problems});
    }
    // 2) Sonda autenticada de leitura: 15 requisições concorrentes, uma por cliente virtual.
    //    Cada ficha é consultada mais de uma vez ao mesmo tempo e as respostas precisam concordar.
    if(!playerStoreEnabled)skipReason='o armazenamento de Players no servidor está desativado';
    else if(!getAuthToken())skipReason='você não está logado no servidor';
    else if(typeof navigator==='undefined'||navigator.onLine===false)skipReason='o aparelho está offline';
    else{
      const realIds=[...new Set((state.players||[]).map(p=>String(p?.id||'').trim()).filter(Boolean))].slice(0,Math.ceil(virtualClients/2));
      if(!realIds.length)skipReason='não há Players cadastrados para consultar';
      else{
        distinctIds=realIds.length;
        const targets=Array.from({length:virtualClients},(_,i)=>realIds[i%realIds.length]);
        const batch=await Promise.all(targets.map(async(id)=>{
          const readStarted=performance.now();
          serverInFlight++; serverMaxInFlight=Math.max(serverMaxInFlight,serverInFlight);
          try{
            const rows=await (async()=>{let timer;try{return await Promise.race([fetchPlayersByIds(id?[id]:[]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('tempo limite de 12 s')),12000)})])}finally{clearTimeout(timer)}})();
            serverReads++; serverLatencyMs.push(Math.round(performance.now()-readStarted));
            return {id,ok:Array.isArray(rows)&&rows.length<=1&&rows.every(r=>r&&String(r.id)===id),count:rows.length};
          }catch(error){serverFailures++;serverLatencyMs.push(Math.round(performance.now()-readStarted));return {id,ok:null,error:String(error?.message||error)}}
          finally{serverInFlight=Math.max(0,serverInFlight-1)}
        }));
        const seen=new Map();
        for(const r of batch){
          if(r.ok===null)continue;
          if(r.ok===false)serverMismatch.push(`resposta inválida para a ficha ${r.id}`);
          const prev=seen.get(r.id);
          if(prev===undefined)seen.set(r.id,r.count);else if(prev!==r.count)serverMismatch.push(`leituras simultâneas da ficha ${r.id} discordaram`);
        }
      }
    }
    const elapsed=Math.round(performance.now()-started);
    const serverLatency=summarizeLatency(serverLatencyMs);
    // Só inconsistência de LÓGICA (simulação ou respostas contraditórias) protege o sync. Falha de rede não.
    const logicFail=!sim.ok||scaleTests.some(x=>!x.ok)||serverMismatch.length>0;
    const outcome=logicFail?'failed':serverFailures>0?'inconclusive':'partial';
    window.__aProfeciaStressReport={status:outcome,build:version,targetUsers:15,virtualClients,cycles,scaleTests,serverReads,serverProbeType:'authenticated-read-only',endToEndValidated:false,serverFailures,serverMaxInFlight,serverLatency,skipReason,simulationProblems:sim.problems,serverMismatch,elapsed,at:Date.now()};
    if(logicFail){
      const why=[...sim.problems,...scaleTests.flatMap(x=>x.problems||[]),...serverMismatch].slice(0,5).join(' | ');
      // Falha na simulação aponta problema no diagnóstico; ela não é uma gravação remota
      // nem uma prova de que os dados reais estão inconsistentes. Nunca bloqueie o sync por este teste.
      log('error',`STRESS TEST ENCONTROU INCONSISTÊNCIA NA SIMULAÇÃO: ${why}`);
      set(status,`🔴 FALHOU • inconsistência no teste`);
      set(details,`Resultado: ${why}. A sincronização real NÃO foi pausada, pois a simulação usa fichas artificiais e não modificou o servidor.`);
      toast('O teste detectou uma inconsistência na simulação. A sincronização real continua ativa.');
    }else if(outcome==='inconclusive'){
      log('warn',`Teste de estresse inconclusivo: ${serverFailures} leituras falharam.`);
      set(status,`🟠 INCONCLUSIVO • ${serverFailures} de ${virtualClients} leituras falharam`);
      set(details,`Escala local (15/20/30/50/100): ${scaleTests.map(x=>`${x.clients}=${x.ok?'OK':'FALHOU'} (${x.elapsed} ms)`).join(' • ')}. Latência das leituras: p50 ${serverLatency.p50} ms • p95 ${serverLatency.p95} ms • máximo ${serverLatency.max} ms. Pode ser instabilidade de rede ou login expirado. A sincronização automática NÃO foi pausada. Tente novamente.`);
      toast('Teste inconclusivo: algumas leituras ao servidor falharam.');
    }else{
      const skipped=skipReason?` A sonda remota foi pulada: ${skipReason}.`:` A sonda autenticada concluiu ${serverReads} leituras; pico de ${serverMaxInFlight} simultâneas.`;
      log('stress-test',`Teste parcial: simulação local consistente; validação ponta a ponta pendente.${skipped}`);
      set(status,'🟡 PARCIAL • simulação consistente; capacidade real ainda não comprovada');
      set(details,`Meta mínima: 15 clientes virtuais. Escala local (15/20/30/50/100): ${scaleTests.map(x=>`${x.clients}=${x.ok?'OK':'FALHOU'} (${x.elapsed} ms)`).join(' • ')}. Leituras autenticadas: ${serverReads}; latência p50 ${serverLatency.p50} ms • p95 ${serverLatency.p95} ms • máximo ${serverLatency.max} ms.${skipped} O teste não grava dados reais e não comprova capacidade ponta a ponta de 15 pessoas; falta um teste E2E isolado que exercite escrita e Realtime com dados descartáveis.`);
      toast('Simulação concluída. A validação real de 15 usuários continua pendente.');
    }
  }catch(error){
    // Erro inesperado do próprio teste: não prova nada sobre os dados, então não pausa o sync.
    const elapsed=Math.round(performance.now()-started);
    window.__aProfeciaStressReport={status:'inconclusive',build:version,targetUsers:15,virtualClients,cycles,scaleTests,serverReads,serverProbeType:'authenticated-read-only',endToEndValidated:false,serverFailures,serverMaxInFlight,serverLatency:summarizeLatency(serverLatencyMs),message:String(error?.message||error),elapsed,at:Date.now()};
    log('warn',`Teste de estresse não concluiu: ${String(error?.message||error)}`);
    set(status,'🟠 INCONCLUSIVO • o teste não conseguiu terminar');
    set(details,`Erro: ${String(error?.message||error)}. A sincronização automática NÃO foi pausada.`);
    toast('O teste não conseguiu terminar. Nada foi alterado.');
  }finally{button.disabled=false;button.textContent=old}
}



/** Verificação local isolada da fila: não lê nem escreve o armazenamento real do usuário. */
export function runPersistenceSelfTest(){
  const status=document.getElementById('playerPersistenceStatus');
  const details=document.getElementById('playerPersistenceDetails');
  const button=document.getElementById('runPersistenceSelfTest');
  if(!button)return;
  button.disabled=true;
  const problems=[];
  const check=(name,condition)=>{if(!condition)problems.push(name)};
  try{
    const unsafe={id:'lab-player-1',login:'lab-player',queuedAt:100,attempts:0,password:'should-not-persist',data:{id:'lab-player-1',hp:17,_syncUpdatedAt:100,password:'secret',newPassword:'secret2',secretLovedEffect:'secret3',nested:{password:'nested-secret'}},baseData:{hp:16,password:'base-secret'}};
    const serialized=serializePlayerQueue([unsafe]);
    const recovered=mergePlayerQueueItems([],JSON.parse(JSON.stringify(serialized)));
    const json=JSON.stringify(recovered).toLowerCase();
    check('fila recuperável após serialização',recovered.length===1&&recovered[0].data.hp===17);
    check('segredos não persistidos',!/(should-not-persist|secret2|secret3|secret|nested-secret|base-secret|\"password\"|\"newpassword\"|\"secretlovedeffect\")/.test(json));
    const large=serializePlayerQueue(Array.from({length:175},(_,i)=>({id:`lab-${i}`,queuedAt:i,data:{hp:i,_syncUpdatedAt:i+1}})));
    check('fila grande não truncada',large.length===175);
    check('objeto original não mutado',unsafe.password==='should-not-persist'&&unsafe.data.password==='secret');
  }catch(error){problems.push(String(error?.message||error))}
  const report={ok:problems.length===0,checksPassed:Math.max(0,4-problems.length),checksTotal:4,problems,at:Date.now()};
  window.__aProfeciaPersistenceReport=report;
  if(status)status.textContent=report.ok?'🟢 PASSOU • persistência local segura':'🔴 FALHOU • verificar relatório';
  if(details)details.textContent=report.ok?'4/4 verificações passaram: recuperação, remoção de segredos, fila grande e integridade do objeto original. Nenhum dado real foi alterado.':problems.join(' • ');
  button.disabled=false;
  return report;
}

/** Verifica cache e versão publicada sem modificar o estado da campanha. */
export async function runDeploymentCacheSelfTest(){
  const button=document.getElementById('runDeploymentCacheCheck');
  const status=document.getElementById('deploymentCacheStatus');
  const details=document.getElementById('deploymentCacheDetails');
  if(!button)return null;
  const old=button.textContent;button.disabled=true;button.textContent='⏳ Verificando...';
  if(status)status.textContent='Consultando HTML publicado sem cache...';
  try{
    const report=await runDeploymentCacheCheck();
    window.__aProfeciaDeploymentReport=report;
    if(status)status.textContent=report.ok?'🟢 PASSOU • versão e cache verificados':'🟠 ATENÇÃO • confira os itens abaixo';
    if(details)details.textContent=`Release ${report.release} • build ${report.buildId} • ${report.checks.map(c=>`${c.ok?'OK':'VERIFICAR'} — ${c.name}${c.detail?`: ${c.detail}`:''}`).join(' • ')}`;
    return report;
  }catch(error){
    const report={ok:false,checks:[{name:'Diagnóstico de cache',ok:false,detail:String(error?.message||error)}],at:Date.now()};
    window.__aProfeciaDeploymentReport=report;if(status)status.textContent='🔴 FALHOU • diagnóstico não concluído';if(details)details.textContent=report.checks[0].detail;return report;
  }finally{button.disabled=false;button.textContent=old;}
}


/** Coleta métricas locais sem tocar no estado ou nos dados da campanha. */
export async function runPerformanceDiagnosticsSelfTest(){
  const button=document.getElementById('runPerformanceDiagnostics');
  const status=document.getElementById('performanceStatus');
  const details=document.getElementById('performanceDetails');
  if(!button)return null;
  const old=button.textContent;button.disabled=true;button.textContent='⏳ Medindo...';
  if(status)status.textContent='Coletando métricas do navegador...';
  try{
    const snapshot=collectPerformanceSnapshot();
    snapshot.responsiveness=await runResponsivenessProbe();
    snapshot.assessment=classifyPerformanceSnapshot(snapshot);
    window.__ashenPerformanceReport=snapshot;
    if(status)status.textContent=snapshot.assessment.level==='attention'?`🔴 Investigar: ${snapshot.assessment.findings.map(item=>item.metric).join(', ')}`:snapshot.assessment.level==='watch'?`🟠 Revisar: ${snapshot.assessment.findings.map(item=>item.metric).join(', ')}`:'🟢 Sem alertas heurísticos nesta coleta; confira as limitações abaixo.';
    if(details)details.textContent=JSON.stringify(snapshot,null,2);
    return snapshot;
  }catch(error){
    const report={error:String(error?.message||error),at:Date.now()};window.__ashenPerformanceReport=report;
    if(status)status.textContent='🔴 Não foi possível concluir a medição.';if(details)details.textContent=JSON.stringify(report,null,2);return report;
  }finally{button.disabled=false;button.textContent=old;}
}

/** Exporta apenas o relatório local de diagnóstico, sem dados da campanha. */
export function bindPerformanceReportExport(){
  const button=document.getElementById('exportPerformanceReport');
  if(!button||button.dataset.bound==='1')return;
  button.dataset.bound='1';
  button.addEventListener('click',()=>{
    const report=globalThis.window?.__ashenPerformanceReport;
    if(!report){globalThis.alert?.('Execute a medição de desempenho antes de exportar.');return;}
    try{
      const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);const link=document.createElement('a');
      link.href=url;link.download=`ashen-performance-${new Date(report.at||Date.now()).toISOString().replace(/[:.]/g,'-')}.json`;
      link.click();URL.revokeObjectURL(url);
    }catch(error){globalThis.alert?.(`Não foi possível exportar o relatório: ${String(error?.message||error)}`);}
  });
}
