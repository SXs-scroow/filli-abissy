from pathlib import Path
p=Path('/mnt/data/projeto/work')
css=p/'styles.css'
s=css.read_text()
# Remove remote font import to eliminate blocking network request and use local fallbacks.
if s.startswith('@import url('):
    s=s.split('\n',1)[1]
# Add performance-safe horror redesign overrides.
override=r'''
/* =========================================================
   A PROFECIA — HORROR UI / PERFORMANCE PASS · 1.0.8
   Visual: dread, occult archive, blood-red accents, restrained motion.
   Performance: no remote font dependency, limited blur/filter, GPU-friendly effects.
   ========================================================= */
:root{
  --horror-black:#030303;
  --horror-ink:#090708;
  --horror-panel:rgba(12,8,9,.94);
  --horror-panel-2:rgba(17,9,11,.92);
  --horror-red:#8f1721;
  --horror-red-hot:#d82b3a;
  --horror-blood:#5e0c14;
  --horror-bone:#e8ddd6;
  --horror-ash:#8d807d;
  --horror-gold:#c79a3b;
  --horror-line:rgba(139,35,46,.42);
}
html{background:var(--horror-black);scroll-behavior:smooth}
body{
  background:
    radial-gradient(ellipse at 50% -15%,rgba(112,9,19,.16),transparent 44%),
    radial-gradient(ellipse at 0% 55%,rgba(74,7,15,.10),transparent 35%),
    linear-gradient(180deg,#080506 0%,#030303 68%,#020202 100%);
}
body::before{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:9998;opacity:.035;
  background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.16) 4px,transparent 5px 8px);
  mix-blend-mode:overlay;
}
.abyss-bg{opacity:.72;background-image:
  radial-gradient(circle at 50% 0%,rgba(130,8,18,.18),transparent 36%),
  radial-gradient(circle at 85% 78%,rgba(75,5,12,.12),transparent 30%),
  linear-gradient(180deg,#0a0708 0,#050404 56%,#020202 100%);
}
.abyss-bg:before,.abyss-bg:after{filter:none;will-change:auto}
.topbar{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:linear-gradient(180deg,rgba(5,3,4,.985),rgba(5,3,4,.94));}
.card,.sheet-card,.home-panel,.class-card,.sound-library-card,.library-book-card{
  content-visibility:auto;contain:layout paint style;
}
.card,.sheet-card{background:linear-gradient(145deg,rgba(15,9,10,.97),rgba(6,5,6,.97));border-color:var(--horror-line)}
.card:hover,.class-card:hover{transform:none;box-shadow:0 14px 38px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.045)}
.card:before{display:none}
.btn{transition:border-color .16s ease,background-color .16s ease,box-shadow .16s ease,color .16s ease}
.btn:hover{transform:none}
.sigil{filter:none;}
.brand img,.profile-seal img{filter:none}
.login-card{box-shadow:0 24px 70px rgba(0,0,0,.72),0 0 70px rgba(111,8,18,.10);}
.login-card::after{
  content:"";position:absolute;inset:0;pointer-events:none;border:1px solid rgba(255,255,255,.035);
  background:linear-gradient(120deg,transparent 0 35%,rgba(255,255,255,.025) 50%,transparent 65%);
}
.title,.hero h1,.card h2,.card h3{font-family:ui-serif,Georgia,'Times New Roman',serif;}
.title{letter-spacing:.16em;text-shadow:0 2px 18px rgba(0,0,0,.9),0 0 24px rgba(151,15,28,.18)}
.hero h1{letter-spacing:.04em;text-shadow:0 3px 24px rgba(0,0,0,.7)}
.badge{background:rgba(64,7,12,.72);border-color:rgba(172,39,52,.55);box-shadow:inset 0 0 14px rgba(165,20,32,.08)}
.section-kicker{letter-spacing:.18em}
.topbar-inner{min-height:66px}
.nav button{transition:color .12s ease,background-color .12s ease,border-color .12s ease}
.nav button.active{box-shadow:inset 0 0 18px rgba(137,15,26,.08)}
.main{position:relative}
.main::before{
  content:"";position:fixed;inset:66px 0 0;pointer-events:none;z-index:-1;opacity:.22;
  background:repeating-linear-gradient(90deg,transparent 0 118px,rgba(125,20,30,.025) 119px 120px),
             linear-gradient(180deg,transparent 0 88%,rgba(0,0,0,.55));
}
.op-home-sheet,.profile-header,.nexus-hero,.master-control-hero{position:relative;overflow:hidden}
.op-home-sheet::before,.profile-header::before,.nexus-hero::before,.master-control-hero::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.45;
  background:radial-gradient(circle at 78% 18%,rgba(167,22,35,.12),transparent 26%),linear-gradient(100deg,transparent,rgba(255,255,255,.012),transparent);
}
.op-home-sheet::after,.profile-header::after{
  content:"";position:absolute;width:260px;height:260px;right:-100px;top:-120px;border:1px solid rgba(139,29,41,.18);border-radius:50%;box-shadow:0 0 0 28px rgba(139,29,41,.025),0 0 0 56px rgba(139,29,41,.018);pointer-events:none;
}
/* A restrained horror status language: danger is red, sanity is cold, gold is reserved for ritual/important actions. */
.horror-home-bars .resource-bar.health .resource-fill{background:linear-gradient(90deg,#5d0b12,#c62a37)}
.horror-home-bars .resource-bar.sanity .resource-fill{background:linear-gradient(90deg,#31265f,#8b6bd1)}
.resource-bar{background:#060506;border-color:#2b1518}
.resource-fill{box-shadow:none!important}
/* Immersive mode: dark theatre rather than a generic dashboard. */
.immersive-page,.immersive-shell{background:radial-gradient(circle at 50% 35%,rgba(83,8,15,.13),transparent 32%),#020202}
.curtain-btn{border-color:#5d1b23;background:linear-gradient(180deg,#18090c,#070506);box-shadow:0 12px 34px rgba(0,0,0,.5),inset 0 0 28px rgba(139,16,29,.08)}
/* Tables/forms remain readable while feeling like an old case file. */
.table-wrap,.slot,.item,.stat,.skill-group,.attribute-box{background:rgba(5,4,5,.88);border-color:rgba(102,26,35,.5)}
.table th{background:#090607;color:#b7a29e}
.field input,.field select,.field textarea{transition:border-color .14s ease,box-shadow .14s ease,background-color .14s ease}
/* Terror overlay */
.terror-overlay{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;background:rgba(0,0,0,.88);overflow:hidden;isolation:isolate}
.terror-overlay::before{content:"";position:absolute;inset:-15%;background:radial-gradient(circle at 50% 46%,transparent 0 15%,rgba(88,0,10,.16) 35%,rgba(0,0,0,.92) 76%);z-index:-1}
.terror-overlay::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.09;background:repeating-linear-gradient(0deg,transparent 0 4px,rgba(255,255,255,.2) 5px,transparent 6px);mix-blend-mode:screen}
.terror-vignette{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 160px 55px rgba(0,0,0,.95),inset 0 0 55px 15px rgba(118,0,15,.32)}
.terror-panel{position:relative;width:min(780px,calc(100vw - 34px));min-height:360px;padding:42px 42px 34px;border:1px solid rgba(155,33,45,.65);background:linear-gradient(145deg,rgba(12,6,8,.98),rgba(2,2,3,.98));box-shadow:0 30px 100px rgba(0,0,0,.8),inset 0 0 50px rgba(120,7,18,.06);text-align:center}
.terror-panel::before{content:"";position:absolute;inset:12px;border:1px solid rgba(208,174,92,.09);pointer-events:none}
.terror-mark{font-size:42px;color:#a41d2a;opacity:.82;line-height:1;margin-bottom:18px}
.terror-kicker{font-size:10px;letter-spacing:.32em;color:#a06b6e;text-transform:uppercase}
.terror-title{margin:12px 0 10px;font:700 clamp(32px,7vw,68px) ui-serif,Georgia,serif;letter-spacing:.12em;text-transform:uppercase;color:#eee3df;text-shadow:0 3px 28px #000,0 0 28px rgba(151,15,28,.2)}
.terror-message{max-width:620px;margin:0 auto;color:#d1c4c0;font-size:16px;line-height:1.75;white-space:pre-wrap}
.terror-subtext{margin:18px auto 0;max-width:580px;color:#746866;font-size:12px;letter-spacing:.08em}
.terror-image{display:block;width:min(100%,520px);max-height:270px;object-fit:cover;margin:0 auto 22px;border:1px solid rgba(141,29,40,.4);filter:brightness(.48) contrast(1.18)}
.terror-close{margin-top:28px}
.terror-admin-preview{border:1px solid #39151b;background:#050304;padding:18px}
@media (max-width:700px){
  .topbar-inner{align-items:flex-start;flex-direction:column;gap:8px}.nav{width:100%;justify-content:flex-start;overflow:auto;flex-wrap:nowrap;padding-bottom:2px}.nav button{flex:0 0 auto}
  .main{padding-left:12px;padding-right:12px}.hero{padding-top:18px}.card,.sheet-card{padding:15px}
  .terror-panel{padding:34px 20px 26px;min-height:300px}.terror-title{letter-spacing:.07em}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}.terror-overlay *,.abyss-bg *{animation:none!important;transition:none!important}
  *{scroll-behavior:auto!important}
}
@media (max-width:700px){.abyss-bg:before,.abyss-bg:after{background-size:170px 170px;opacity:.025}}
'''
s += '\n' + override
css.write_text(s)

app=p/'app.js'
a=app.read_text()
# Add terror editor/overlay after defaultTerrorMode declaration if absent.
needle="function defaultTerrorMode(){return {active:false,title:'MODO TERROR',message:'',subtext:'',image:'',updatedAt:0}}\n"
if 'function terrorOverlay(' not in a:
    insert=r'''function terrorOverlay(){
  const t={...defaultTerrorMode(),...(state.terrorMode||{})};
  const image=t.image?`<img class="terror-image" src="${esc(safeImgSrc(t.image,''))}" alt="">`:'';
  return `<div id="terrorOverlay" class="terror-overlay" role="dialog" aria-modal="true" aria-label="Modo Terror">
    <div class="terror-vignette" aria-hidden="true"></div>
    <section class="terror-panel">
      <div class="terror-mark" aria-hidden="true">☩</div>
      <div class="terror-kicker">A PROFECIA · AVISO</div>
      ${image}
      <h1 class="terror-title">${esc(t.title||'MODO TERROR')}</h1>
      <p class="terror-message">${esc(t.message||'Algo mudou.\nVocê percebeu tarde demais.')}</p>
      ${t.subtext?`<p class="terror-subtext">${esc(t.subtext)}</p>`:''}
      <button type="button" class="btn danger terror-close" id="forceDisableTerror">Continuar</button>
    </section>
  </div>`;
}
function openTerrorEditor(){
  const t={...defaultTerrorMode(),...(state.terrorMode||{})};
  openModal(`<div class="modal" id="terrorEditorModal"><div class="modal-card terror-admin-preview">
    <button class="modal-close" id="closeTerrorEditor">×</button>
    <span class="badge">ATMOSFERA</span><h2>Modo Terror</h2>
    <p class="small muted">Crie uma cena curta de tensão para todos os Players. Prefira sugestão e expectativa a sustos repetidos.</p>
    <div class="field"><label>Título</label><input id="terrorTitle" maxlength="80" value="${esc(t.title)}" placeholder="Ex.: NÃO OLHE PARA TRÁS"></div>
    <div class="field"><label>Mensagem</label><textarea id="terrorMessage" rows="6" maxlength="1200" placeholder="Algo está acontecendo...">${esc(t.message)}</textarea></div>
    <div class="field"><label>Subtexto</label><input id="terrorSubtext" maxlength="220" value="${esc(t.subtext)}" placeholder="Uma frase curta, quase sussurrada."></div>
    <div class="field"><label>Imagem opcional</label><input id="terrorImage" value="${esc(t.image)}" placeholder="URL de uma imagem já disponível no projeto"></div>
    <label class="row small" style="gap:8px;margin:12px 0"><input id="terrorActive" type="checkbox" ${t.active?'checked':''}> Ativar imediatamente para a sessão</label>
    <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn" id="cancelTerrorEditor">Cancelar</button><button class="btn danger" id="saveTerrorEditor">${t.active?'Atualizar cena':'Ativar modo terror'}</button></div>
  </div></div>`);
  const close=()=>document.getElementById('terrorEditorModal')?.remove();
  document.getElementById('closeTerrorEditor')?.addEventListener('click',close);
  document.getElementById('cancelTerrorEditor')?.addEventListener('click',close);
  document.getElementById('saveTerrorEditor')?.addEventListener('click',async()=>{
    const next={...defaultTerrorMode(),title:document.getElementById('terrorTitle')?.value.trim()||'MODO TERROR',message:document.getElementById('terrorMessage')?.value.trim()||'Algo mudou.\nVocê percebeu tarde demais.',subtext:document.getElementById('terrorSubtext')?.value.trim()||'',image:document.getElementById('terrorImage')?.value.trim()||'',active:!!document.getElementById('terrorActive')?.checked,updatedAt:Date.now()};
    state.terrorMode=next;
    close();
    try{await saveGlobalNow();toast(next.active?'O Modo Terror foi transmitido.':'O Modo Terror foi salvo desativado.');}
    catch(e){toast('A cena foi salva localmente, mas não foi possível sincronizar agora.');console.warn(e)}
    render(currentView||'home');
  });
}
'''
    a=a.replace(needle,needle+insert)
# Ensure disabling terror saves state before rerender.
a=a.replace("document.getElementById('terrorOverlay')?.remove();render(currentView||'home')", "document.getElementById('terrorOverlay')?.remove();save();render(currentView||'home')")
# Performance: avoid full DOM scroll-tree scan; preserve only known scroll containers.
old="""function captureInnerScroll(root){const out=[];if(!root)return out;const all=root.querySelectorAll('*');for(let i=0;i<all.length;i++){const el=all[i];if(el.scrollLeft>0||el.scrollTop>0)out.push({i,tag:el.tagName,cls:el.className,l:el.scrollLeft,t:el.scrollTop})}return out}\nfunction restoreInnerScroll(root,saved){if(!root||!saved?.length)return;const all=root.querySelectorAll('*');for(const it of saved){const el=all[it.i];if(el&&el.tagName===it.tag&&el.className===it.cls){el.scrollLeft=it.l;el.scrollTop=it.t}}}"""
new="""function captureInnerScroll(root){if(!root)return [];const selectors=['.panel-tabs','.table-wrap','.panel-scroll','.horizontal-scroll','.slot-grid'];const out=[];for(const sel of selectors){for(const el of root.querySelectorAll(sel)){if(el.scrollLeft>0||el.scrollTop>0)out.push({sel,l:el.scrollLeft,t:el.scrollTop})}}return out}\nfunction restoreInnerScroll(root,saved){if(!root||!saved?.length)return;const buckets=new Map();for(const it of saved){const list=buckets.get(it.sel)||[];list.push(it);buckets.set(it.sel,list)}for(const [sel,list] of buckets){const els=root.querySelectorAll(sel);list.forEach((it,i)=>{const el=els[i];if(el){el.scrollLeft=it.l;el.scrollTop=it.t}})}}"""
if old in a:a=a.replace(old,new)
# Avoid redundant double scroll frame; one synchronous restoration is enough for most views.
a=a.replace("if(same){jumpScroll(y);restoreInnerScroll(rootEl,inner);requestAnimationFrame(()=>{jumpScroll(y);restoreInnerScroll(rootEl,inner)})}","if(same){jumpScroll(y);restoreInnerScroll(rootEl,inner)}")
# Version bump.
a=a.replace("const APP_VERSION='V1.0.7 · HARDENING DE SEGURANÇA · FIX 3';","const APP_VERSION='V1.0.8 · HORROR UI · PERFORMANCE PASS';")
app.write_text(a)

# Version/cache bust.
idx=p/'index.html'; h=idx.read_text().replace('main.js?v=1073','main.js?v=1080'); idx.write_text(h)
main=p/'src/main.js'; m=main.read_text().replace("../app.js?build=1073","../app.js?build=1080"); main.write_text(m)
# Vite config: stable explicit port and HMR overlay; no forced dependency reoptimization every launch.
v=p/'vite.config.js'; vs=v.read_text().replace("server: { host: true, port: 5173 },","server: { host: true, port: 5173, strictPort: false },"); v.write_text(vs)
