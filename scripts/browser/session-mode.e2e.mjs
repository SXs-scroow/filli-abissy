// Modo Sessão do Mestre (presença online, vitais, combate, rolagens e ferramentas).
// Uso: npm run dev (outro terminal) → node scripts/browser/session-mode.e2e.mjs http://localhost:5173/
// Requer o pacote "playwright" instalado. A presença é simulada pelo evento 'ashen-presence-sim'.
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:5173/';
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:900}});
await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))errs.push(m.text())});
page.on('dialog',d=>d.accept());
await page.addInitScript(()=>{sessionStorage.setItem('a_profecia_session_tab_v1',JSON.stringify({role:'master'}));
 if(!localStorage.getItem('filii_abyssi_state_v15'))localStorage.setItem('filii_abyssi_state_v15',JSON.stringify({version:1,session:{role:'master'},
  players:[{id:'p1',login:'zeck',name:'Zeck',class:'Caçador',hp:20,hpMax:20,sanity:10,sanityMax:10,rolls:[{id:'r1',value:17,label:'Percepção • d20',die:'Percepção',text:'17 = 17',createdAt:Date.now(),time:'20:00:00'}]},{id:'p2',login:'ana',name:'Ana',class:'Mago',hp:15,hpMax:15,sanity:8,sanityMax:8},{id:'p3',login:'leo',name:'Leo',class:'Herege',hp:12,hpMax:12}],
  creatures:[{id:'m1',name:'Zumbi',hp:20,hpMax:20,attack:2,defense:1,damage:'1d6'}],
  combatSession:{sessionId:'s1',title:'Mansão Drevis',participants:[{key:'player:p1',kind:'player',entityId:'p1',entityLogin:'zeck',name:'Zeck',initiative:0,turnOrder:0,enabled:true},{key:'player:p2',kind:'player',entityId:'p2',entityLogin:'ana',name:'Ana',initiative:0,turnOrder:1,enabled:true}],updatedAt:1}}))});
const ok=(n,c)=>console.log((c?'PASS  ':'FAIL  ')+n);
const st=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('filii_abyssi_state_v15')));
const wait=ms=>page.waitForTimeout(ms);
await page.goto(BASE);await wait(1300);
ok('botão Sessão no menu do Mestre',await page.locator('[data-nav="session"]').count()===1);
await page.click('[data-nav="session"]');await wait(600);
ok('tela do Modo Sessão abriu',await page.locator('.sm-grid').count()===1);
ok('2 players na sessão + 1 fora',await page.locator('.sm-player').count()===3);
ok('presença indisponível sem servidor',/indispon/i.test(await page.locator('#smOnlineCount').innerText()));
// presence simulation
await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ashen-presence-sim',{detail:{p1:[{role:'player',lastSeen:Date.now()}],master:[{role:'master'}]}})));await wait(200);
ok('contador: 1/3 online',/1\/3 online/.test(await page.locator('#smOnlineCount').innerText()));
ok('Zeck online (bolinha verde)',await page.locator('[data-sm-player="p1"] .sm-dot.online').count()===1);
ok('Ana offline',await page.locator('[data-sm-player="p2"] .sm-dot.offline').count()===1);
// player HP/SAN steps
const hpShown=async()=>Number((await page.locator('[data-sm-player="p1"] [data-sm-val="hp"]').innerText()).split('/')[0]);
const hp0=await hpShown();
await page.locator('[data-sm-player="p1"] [data-sm-step][data-field="hp"][data-d="-5"]').click();await wait(1300);
let s=await st();ok('Zeck −5 vida ('+hp0+'→'+s.players[0].hp+')',s.players[0].hp===hp0-5&&await hpShown()===hp0-5);
await page.locator('[data-sm-player="p1"] [data-sm-step][data-field="hp"][data-d="1"]').click();await wait(1300);
ok('Zeck +1 vida',(await st()).players[0].hp===hp0-4);
await page.locator('[data-sm-player="p2"] [data-sm-step][data-field="sanity"][data-d="-1"]').click();await wait(1300);
ok('Ana −1 sanidade (8→7)',(await st()).players[1].sanity===7);
ok('continua na tela Sessão após ações',await page.locator('.sm-grid').count()===1);
ok('presença mantida após re-render',await page.locator('[data-sm-player="p1"] .sm-dot.online').count()===1);
// monsters
await page.click('#combatAddMonster');await wait(300);await page.locator('[data-add-combat-monster="m1"]').click();await wait(900);
ok('monstro entrou e ficou na tela Sessão',await page.locator('.sm-monster').count()===1&&await page.locator('.sm-grid').count()===1);
await page.locator('.sm-monster [data-delta="-5"]').click();await wait(1000);
ok('monstro −5 (20→15)',(await st()).creatures[0].hp===15);
await page.click('#combatRollMonsterInit');await wait(700);
ok('iniciativa dos monstros rolada',(await st()).combatSession.participants.find(p=>p.kind==='monster').initiative>=1);
// combat flow
await page.locator('[data-sm-player="p1"] input[data-combat-participant-key]').fill('12');await page.locator('[data-sm-player="p1"] input[data-combat-participant-key]').dispatchEvent('change');await wait(900);
await page.click('#combatStart');await wait(900);
let cs=(await st()).combatSession;ok('iniciar combate ativa ('+cs.currentKey+')',cs.active===true&&!!cs.currentKey);
ok('ainda na tela Sessão após iniciar',await page.locator('.sm-grid').count()===1);
await page.click('#combatNext');await wait(900);
ok('próximo turno avança',(await st()).combatSession.turn===2);
// tools
await page.selectOption('#masterSecretTarget','zeck');await page.fill('#masterSecretTitle','Teste');await page.fill('#masterSecretMessage','Segredo');await page.click('#masterSendSecret');await wait(1200);
console.log('pista -> toast:',(await page.locator('#toast-root').innerText()).slice(0,90).replace(/\n/g,' '));
ok('rolagens ao vivo mostram a rolagem do Zeck',/17/.test(await page.locator('#rollsFeed').innerText()));
ok('botões de ferramenta presentes',await page.locator('#openSessionPuzzleManager,#openSessionMasterNotes,#masterMusicPlay,#masterTerrorMode').count()===4);
await page.screenshot({path:'session-mode.png',fullPage:true});
// player quick action modal still works and returns to session
await page.locator('[data-sm-player="p1"] [data-combat-player-action]').click();await wait(300);
ok('ações rápidas abre modal',await page.locator('#combatStatusModal').count()===1);
await page.click('#cancelCombatStatus');await wait(200);
// navigation back to home keeps working
await page.click('[data-nav="home"]');await wait(500);ok('Início ainda funciona',await page.locator('.combat-control-grid').count()===1);
console.log('erros:',errs);await b.close();
