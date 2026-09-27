/* Agente de Manutenção — camada segura e local.
 * Não possui acesso a SQL, credenciais, deploy ou operações destrutivas.
 * Diagnostica erros do navegador, estado da sessão/sincronização e gera
 * propostas de correção/recovery. Qualquer alteração de código fica como
 * proposta exportável, nunca aplicada automaticamente.
 */
const AGENT_VERSION='1.0.0-safe';
const events=[];
const MAX_EVENTS=80;
let modalOpen=false;
let bound=false;
const aiMessages=[];
let aiBusy=false;
const now=()=>new Date().toISOString();
function addEvent(type,message,extra={}){
  events.push({time:now(),type,message:String(message||''),...extra});
  if(events.length>MAX_EVENTS)events.splice(0,events.length-MAX_EVENTS);
}
function context(){try{return typeof window.__aProfeciaMaintenanceContext==='function'?window.__aProfeciaMaintenanceContext():{}}catch{return {}}}
function status(){
  const c=context();
  const online=navigator.onLine!==false;
  const guardian=c.guardian||{};
  const errors=events.filter(e=>e.type==='error'||e.type==='rejection').length;
  return {online,guardian,session:c.session||{},players:c.players||{},errors,agentVersion:AGENT_VERSION,checkedAt:now()};
}
function classify(s){
  const issues=[];
  if(!s.online)issues.push({level:'critical',code:'NETWORK_OFFLINE',title:'Sem conexão',action:'Aguardar reconexão; não alterar dados.'});
  if(s.guardian?.state==='session')issues.push({level:'critical',code:'SESSION',title:'Sessão não confirmada',action:'Verificar a sessão antes de tentar qualquer escrita.'});
  if(s.guardian?.state==='attention')issues.push({level:'warning',code:'SYNC',title:'Sincronização em atenção',action:'Executar recuperação segura e repetir a leitura do servidor.'});
  if(s.players?.readOnly)issues.push({level:'warning',code:'PLAYER_READONLY',title:'Sincronização dos Players pausada',action:'Executar reconciliação segura; não recriar Players localmente.'});
  if(s.errors>0)issues.push({level:'warning',code:'RUNTIME_ERRORS',title:`${s.errors} erro(s) do navegador registrados`,action:'Revisar o relatório antes de aplicar qualquer correção.'});
  if(!issues.length)issues.push({level:'ok',code:'HEALTHY',title:'Nenhum problema crítico detectado',action:'Continuar monitorando.'});
  return issues;
}
function safeRecovery(){
  addEvent('action','Recuperação segura solicitada pelo Mestre');
  try{if(typeof window.__aProfeciaMaintenanceRecover==='function')return Promise.resolve(window.__aProfeciaMaintenanceRecover());}catch(e){addEvent('error',e.message||e)}
  return Promise.resolve(false);
}
function proposal(){
  const s=status(),issues=classify(s);
  const lines=[
    '# Agente de Manutenção — proposta segura',
    `Gerado em: ${now()}`,
    `Agente: ${AGENT_VERSION}`,
    '',
    '## Estado observado',
    `Rede: ${s.online?'online':'offline'}`,
    `Guardião: ${s.guardian?.state||'desconhecido'} — ${s.guardian?.message||'sem mensagem'}`,
    `Players: ${s.players?.count??'desconhecido'}`,
    `Erros registrados: ${s.errors}`,
    '',
    '## Diagnóstico',
    ...issues.map(i=>`- [${i.level.toUpperCase()}] ${i.code}: ${i.title}. ${i.action}`),
    '',
    '## Limites de segurança',
    '- Não apagar Players.',
    '- Não alterar senhas ou permissões.',
    '- Não executar SQL destrutivo.',
    '- Não fazer deploy automático.',
    '- Correções de código devem ser geradas como proposta e testadas antes de aplicar.',
    '',
    '## Próximo passo sugerido',
    issues.some(i=>i.level==='critical')?'Resolver a causa crítica antes de qualquer mudança de código.':'Executar testes automatizados e, se necessário, gerar um patch isolado para revisão.'
  ];
  return lines.join('\n');
}
async function askAI(text){
  const token=(()=>{try{return sessionStorage.getItem('a_profecia_auth_token_v1')||''}catch{return ''}})();
  if(!token)throw new Error('SESSAO_INVALIDA');
  const messages=[...aiMessages,{role:'user',content:text}];
  const response=await fetch('/api/maintenance-ai',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({messages,diagnostics:proposal()})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.message||data?.error||`HTTP ${response.status}`);
  aiMessages.push({role:'user',content:text},{role:'assistant',content:String(data.message||'')});
  return data.message||'';
}
function download(text,name,type='text/plain'){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderModal(){
  const s=status(),issues=classify(s);
  const root=document.getElementById('maintenance-agent-root');if(!root)return;
  root.innerHTML=`<div class="maintenance-backdrop" data-maint-close></div><section class="maintenance-modal" role="dialog" aria-modal="true" aria-label="Agente de Manutenção">
    <header class="maintenance-head"><div><span class="section-kicker">OFICINA DE SEGURANÇA</span><h2>Agente de Manutenção</h2><p>Diagnóstico e recuperação sem acesso destrutivo.</p></div><button class="maintenance-x" data-maint-close aria-label="Fechar">×</button></header>
    <div class="maintenance-grid">
      <article class="maintenance-card"><span>ESTADO</span><strong>${s.online?'🟢 Online':'🔴 Offline'}</strong><small>Guardião: ${esc(s.guardian?.state||'desconhecido')}</small></article>
      <article class="maintenance-card"><span>PLAYERS</span><strong>${esc(s.players?.count??'?')}</strong><small>${esc(s.players?.readOnly?'Sincronização em recuperação':'Sincronização normal')}</small></article>
      <article class="maintenance-card"><span>ERROS</span><strong>${s.errors}</strong><small>capturados nesta abertura</small></article>
    </div>
    <div class="maintenance-section"><h3>Diagnóstico</h3>${issues.map(i=>`<div class="maintenance-issue ${i.level}"><b>${esc(i.title)}</b><small>${esc(i.action)}</small></div>`).join('')}</div>
    <div class="maintenance-actions"><button class="btn primary" data-maint-recover>↻ Recuperação segura</button><button class="btn" data-maint-ai>✦ Consultar IA</button><button class="btn" data-maint-proposal>Gerar proposta</button><button class="btn" data-maint-export>Exportar relatório</button></div>
    <section class="maintenance-ai" data-maint-ai-panel hidden>
      <div class="maintenance-ai-head"><div><b>IA de Manutenção</b><small>Diagnostica e propõe correções; não altera o site automaticamente.</small></div></div>
      <div class="maintenance-ai-log" data-maint-ai-log>${aiMessages.length?aiMessages.map(m=>`<div class="maintenance-ai-msg ${m.role}"><b>${m.role==='assistant'?'IA':'Você'}</b><div>${esc(m.content)}</div></div>`).join(''):'<div class="maintenance-ai-empty">Pergunte sobre um erro ou peça uma análise do diagnóstico atual.</div>'}</div>
      <div class="maintenance-ai-form"><textarea data-maint-ai-input rows=3 placeholder="Ex.: analise os erros atuais e diga qual correção é mais segura"></textarea><button class="btn primary" data-maint-ai-send ${aiBusy?'disabled':''}>${aiBusy?'Analisando…':'Enviar'}</button></div>
    </section>
    <details class="maintenance-log"><summary>Eventos registrados (${events.length})</summary><pre>${esc(events.map(e=>`[${e.time}] ${e.type}: ${e.message}`).join('\n')||'Nenhum evento.')}</pre></details>
    <footer>Agente ${AGENT_VERSION} • Sem SQL • Sem exclusão • Sem deploy automático</footer>
  </section>`;
  root.querySelectorAll('[data-maint-close]').forEach(x=>x.onclick=close);
  root.querySelector('[data-maint-recover]')?.addEventListener('click',async()=>{await safeRecovery();renderModal()});
  root.querySelector('[data-maint-ai]')?.addEventListener('click',()=>{const panel=root.querySelector('[data-maint-ai-panel]');if(panel){panel.hidden=!panel.hidden;if(!panel.hidden)root.querySelector('[data-maint-ai-input]')?.focus()}});
  root.querySelector('[data-maint-ai-send]')?.addEventListener('click',async()=>{const input=root.querySelector('[data-maint-ai-input]');const value=String(input?.value||'').trim();if(!value||aiBusy)return;aiBusy=true;renderModal();try{await askAI(value)}catch(e){addEvent('error',e?.message||e);alert(`IA: ${e?.message||e}`)}finally{aiBusy=false;renderModal();const panel=root.querySelector('[data-maint-ai-panel]');if(panel)panel.hidden=false}});
  root.querySelector('[data-maint-proposal]')?.addEventListener('click',()=>download(proposal(),`a-profecia-proposta-manutencao-${Date.now()}.md`));
  root.querySelector('[data-maint-export]')?.addEventListener('click',()=>download(JSON.stringify({status:s,issues,events,proposal:proposal()},null,2),`a-profecia-diagnostico-${Date.now()}.json`,'application/json'));
}
function open(){modalOpen=true;renderModal();document.body.classList.add('maintenance-open')}
function close(){modalOpen=false;const r=document.getElementById('maintenance-agent-root');if(r)r.innerHTML='';document.body.classList.remove('maintenance-open')}
function ensure(){
  if(!document.getElementById('maintenance-agent-root')){const r=document.createElement('div');r.id='maintenance-agent-root';document.body.appendChild(r)}
  let b=document.getElementById('maintenance-agent-button');
  if(!b){b=document.createElement('button');b.id='maintenance-agent-button';b.className='maintenance-agent-button';b.type='button';b.innerHTML='🛠️ <span>Manutenção</span>';b.title='Abrir Agente de Manutenção';b.onclick=open;document.body.appendChild(b)}
  const isMaster=!!context().session?.role&&context().session.role==='master';b.hidden=!isMaster;
  if(modalOpen)renderModal();
}
function bind(){if(bound)return;bound=true;window.addEventListener('error',e=>addEvent('error',e.message||'Erro JavaScript',{source:e.filename||'',line:e.lineno||0}));window.addEventListener('unhandledrejection',e=>addEvent('rejection',e.reason?.message||String(e.reason||'Promise rejeitada')));window.addEventListener('online',()=>addEvent('network','Conexão restabelecida'));window.addEventListener('offline',()=>addEvent('network','Conexão perdida'));setInterval(ensure,2000);ensure()}
window.__aProfeciaMaintenance={version:AGENT_VERSION,open,close,status,proposal,events,ensure};
window.addEventListener('DOMContentLoaded',bind,{once:true});
setTimeout(bind,0);
