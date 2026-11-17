// Fluxos da ficha do player: identidade, atributos, perícias, mochila, classe e notas.
// Uso: npm run dev (outro terminal) → node scripts/browser/sheet-flows.e2e.mjs http://localhost:5173/
// Requer o pacote "playwright" instalado (não faz parte das dependências do projeto).
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:5173/';
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1100,height:900}});
await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR '+e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))errs.push(m.text())});
page.on('dialog',d=>d.accept());
await page.addInitScript(()=>{
 sessionStorage.setItem('a_profecia_session_tab_v1',JSON.stringify({role:'player',playerId:'p1',login:'zeck'}));
 if(!localStorage.getItem('filii_abyssi_state_v15'))localStorage.setItem('filii_abyssi_state_v15',JSON.stringify({version:1,session:{role:'player',playerId:'p1',login:'zeck'},players:[{id:'p1',login:'zeck',name:'Zeck',class:'',hp:10,hpMax:10}],creatures:[],combatSession:{sessionId:'s1',participants:[]}}));});
const st=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('filii_abyssi_state_v15')));
const toast=()=>page.locator('#toast-root').innerText().catch(()=>'');
await page.goto(BASE);await page.waitForTimeout(1200);
await page.evaluate(()=>document.querySelector('[data-nav="sheet"]')?.click());await page.waitForTimeout(700);
console.log('attr inputs:',await page.locator('.pAttr').count(),'skill inputs:',await page.locator('.pSkill').count(),'class select:',await page.locator('#pClass').count(),'saveIdentity:',await page.locator('#saveIdentity').count());
console.log('remaining attr:',await page.locator('#attrRemaining').innerText(),'| skill:',await page.locator('#skillRemaining').innerText().catch(()=>'-'));
// 1 identity save
await page.fill('#pName','Zeck Silva');await page.click('#saveIdentity');await page.waitForTimeout(1300);
console.log('1 identidade ->',(await st()).players[0].name,'| toast:',await toast());
// 2 attrs
const attrs=await page.locator('.pAttr').evaluateAll(e=>e.map(x=>x.dataset.attr||x.name||x.id));console.log('attrs:',attrs.join(','));
await page.locator('.pAttr').nth(0).fill('3');await page.locator('.pAttr').nth(0).dispatchEvent('input');
await page.locator('.pAttr').nth(1).fill('2');await page.locator('.pAttr').nth(1).dispatchEvent('input');await page.waitForTimeout(300);
console.log('remaining after typing:',await page.locator('#attrRemaining').innerText());
await page.click('#saveAttrs');await page.waitForTimeout(1300);
const p1=(await st()).players[0];console.log('2 attrs saved ->',JSON.stringify(Object.fromEntries(Object.entries(p1.attrs||{}).filter(([k,v])=>v))),'| toast:',await toast());
// too many points
await page.locator('.pAttr').nth(2).fill('8');await page.locator('.pAttr').nth(2).dispatchEvent('input');await page.click('#saveAttrs');await page.waitForTimeout(800);
console.log('3 excesso ->',await toast(),'| saved attr3:',(await st()).players[0].attrs[attrs[2]]);
// skills
await page.evaluate(()=>document.querySelector('[data-sheet-tab-btn="pericias"]')?.click());
await page.locator('.pSkill').nth(0).fill('2');await page.locator('.pSkill').nth(0).dispatchEvent('input');await page.click('#saveSkills');await page.waitForTimeout(1300);
console.log('4 skills ->',JSON.stringify(Object.fromEntries(Object.entries((await st()).players[0].skills||{}).filter(([k,v])=>v))),'| toast:',await toast());
// bag
await page.evaluate(()=>document.querySelector('[data-sheet-tab-btn="mochila"]')?.click());await page.waitForTimeout(200);
console.log('bag btn:',await page.locator('#addBagItem').count());
await page.click('#addBagItem');await page.waitForTimeout(300);console.log('bag modal:',await page.locator('#bagPlayerModal').count());
await page.fill('#bagPlayerSearch','300');await page.click('#bagPlayerAdd');await page.waitForTimeout(1200);
console.log('5 bag ->',JSON.stringify((await st()).players[0].backpack),'| toast:',await toast());
const rm=page.locator('[data-remove-slot]');console.log('remove btns:',await rm.count());
if(await rm.count()){await rm.first().click();await page.waitForTimeout(1200);console.log('6 removed ->',JSON.stringify((await st()).players[0].backpack))}
// class
await page.evaluate(()=>document.querySelector('[data-sheet-tab-btn="essencial"]')?.click());
const opts=await page.locator('#pClass option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));console.log('classes:',opts.slice(0,6).join(','));
await page.selectOption('#pClass',opts[0]);await page.waitForTimeout(1300);console.log('7 classe ->',(await st()).players[0].class,'| toast:',await toast());
// notes / story save (tab historia)
await page.evaluate(()=>document.querySelector('[data-sheet-tab-btn="historia"]')?.click());
const notes=page.locator('#playerNotes');console.log('notes present:',await notes.count());
await notes.fill('anotação teste');await notes.dispatchEvent('input');await notes.dispatchEvent('change');await page.waitForTimeout(1500);
console.log('8 notas ->',(await st()).players[0].playerNotes);
console.log('erros:',errs);await b.close();
