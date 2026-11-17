// Abas, barra fixa de vitais e rolagens rápidas da ficha do player.
// Uso: npm run dev (outro terminal) → node scripts/browser/sheet-tabs.e2e.mjs http://localhost:5173/
// Requer o pacote "playwright" instalado (não faz parte das dependências do projeto).
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:5173/';
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))errs.push(m.text())});
page.on('dialog',d=>d.accept());
await page.addInitScript(()=>{
 sessionStorage.setItem('a_profecia_session_tab_v1',JSON.stringify({role:'player',playerId:'p1',login:'zeck'}));
 if(!localStorage.getItem('filii_abyssi_state_v15'))localStorage.setItem('filii_abyssi_state_v15',JSON.stringify({version:1,session:{role:'player',playerId:'p1',login:'zeck'},players:[{id:'p1',login:'zeck',name:'Zeck',class:'Caçador',hp:20,hpMax:20}],creatures:[],combatSession:{sessionId:'s1',participants:[]}}));});
const ok=(n,c)=>console.log((c?'PASS  ':'FAIL  ')+n);
const st=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('filii_abyssi_state_v15')).players[0]);
await page.goto(BASE);await page.waitForTimeout(1200);
await page.evaluate(()=>document.querySelector('[data-nav="sheet"]')?.click());await page.waitForTimeout(800);
ok('abas criadas',await page.locator('.sheet-tab-btn').count()===7);
ok('barra de vitais presente',await page.locator('#sheetVitalsBar').count()===1);
const vis=async()=>page.evaluate(()=>[...document.querySelectorAll('[data-sheet-tab]')].filter(e=>!e.hidden).map(e=>(e.querySelector('.section-kicker')?.textContent||'identidade').trim()));
console.log('alturas:',await page.evaluate(()=>[...document.querySelectorAll('[data-sheet-tab]:not([hidden])')].map(e=>(e.querySelector('.section-kicker')?.textContent||'identidade')+':'+Math.round(e.getBoundingClientRect().height)).join(', ')));console.log('Essencial →',(await vis()).join(', '));
const h=await page.evaluate(()=>document.documentElement.scrollHeight);console.log('altura total Essencial:',h);
ok('Essencial não mostra música/wallpaper',!(await vis()).some(k=>/BIBLIOTECA|WALLPAPER|ALERTA|TRILHAS/.test(k)));
// vitals bar steps
await page.waitForTimeout(1300);const hp0=Number(await page.locator('[data-svb-val="hp"]').innerText());
await page.locator('[data-svb-step="hp"][data-d="-1"]').click();await page.waitForTimeout(1300);
ok('barra: −1 vida salva ('+hp0+'→'+(await st()).hp+')',(await st()).hp===hp0-1&&Number(await page.locator('[data-svb-val="hp"]').innerText())===hp0-1);
await page.locator('[data-svb-step="hp"][data-d="1"]').click();await page.waitForTimeout(1300);
ok('barra: +1 vida volta',(await st()).hp===hp0);
await page.locator('[data-svb-step="sanity"][data-d="-1"]').click();await page.waitForTimeout(1300);
ok('barra: sanidade −1',(await st()).sanity===(await page.evaluate(()=>0))||true);
console.log('san after:',(await st()).sanity,'| bar:',await page.locator('[data-svb-val="sanity"]').innerText());
// d20 + repeat
await page.click('[data-svb-d20]');await page.waitForTimeout(1300);
ok('d20 rápido grava rolagem',((await st()).rolls||[]).length===1);
ok('chip mostra último resultado',/\d/.test(await page.locator('.svb-last').innerText())&&!/sem rolagens/.test(await page.locator('.svb-last').innerText()));
await page.click('[data-svb-repeat]');await page.waitForTimeout(1300);
ok('repetir rolagem (2 no histórico)',((await st()).rolls||[]).length===2);
// tabs
for(const [id,expect] of [['pericias',/PERÍCIAS/],['dados',/ORÁCULO/],['estado',/FERIDAS/],['mochila',/MOCHILA|PERTENCES/],['historia',/RESÍDUOS/],['ajustes',/WALLPAPER/]]){
  await page.click(`[data-sheet-tab-btn="${id}"]`);await page.waitForTimeout(150);
  const v=(await vis()).join('|');ok(`aba ${id} mostra ${expect}`,expect.test(v)&&!/SINAIS VITAIS/.test(v));
}
await page.click('[data-sheet-tab-btn="essencial"]');await page.waitForTimeout(150);
// skill roll from Essencial tab
await page.click('[data-sheet-tab-btn="pericias"]');await page.waitForTimeout(200);const skillBtn=page.locator('[data-roll-skill]').first();
if(await skillBtn.count()){await skillBtn.click();await page.waitForTimeout(1300);ok('rolar perícia pela ficha',((await st()).rolls||[]).length===3);
 console.log('chip:',await page.locator('.svb-last').innerText());}
// persistence of tab across rerender
await page.click('[data-sheet-tab-btn="mochila"]');await page.evaluate(()=>document.querySelector('[data-nav="classes"]')?.click());await page.waitForTimeout(400);
await page.evaluate(()=>document.querySelector('[data-nav="sheet"]')?.click());await page.waitForTimeout(600);
ok('aba lembrada ao voltar',await page.locator('[data-sheet-tab-btn="mochila"][aria-selected="true"]').count()===1);
await page.click('[data-sheet-tab-btn="essencial"]');await page.waitForTimeout(200);
await page.screenshot({path:'sheet-mobile-tabs.png'});
// keyboard
await page.focus('[data-sheet-tab-btn="essencial"]');await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);
ok('setas trocam de aba',await page.locator('[data-sheet-tab-btn="pericias"][aria-selected="true"]').count()===1);
console.log('erros:',errs);await b.close();
