// Teste de ponta a ponta (navegador) dos monstros e do combate do Mestre.
// Uso:  npm run dev   (outro terminal)   →   node scripts/browser/monster-ui.e2e.mjs http://localhost:5173/
// Requer o pacote "playwright" instalado (não faz parte das dependências do projeto).
// Semeia um Mestre e dados de exemplo no localStorage do navegador de teste; não toca no servidor.
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:5173/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());
await page.addInitScript(() => {
  sessionStorage.setItem('a_profecia_session_tab_v1', JSON.stringify({ role: 'master' }));
  const k = 'filii_abyssi_state_v15';
  if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({
    version: 1, session: { role: 'master' },
    players: [{ id: 'p1', login: 'zeck', name: 'Zeck', class: 'Caçador', hp: 20, hpMax: 20 }],
    creatures: [
      { id: 'm1', name: 'Zumbi', hp: 20, hpMax: 20, attack: 2, defense: 1, damage: '1d6', status: 'Ativo' },
      { id: 'm2', name: 'Cultista', hp: '12', hpMax: 12, attack: 1, defense: 0, damage: '1d4', status: 'Ativo' }],
    combatSession: { sessionId: 's1', participants: [{ key: 'player:p1', kind: 'player', entityId: 'p1', entityLogin: 'zeck', name: 'Zeck', initiative: 0, turnOrder: 0, enabled: true }], updatedAt: 1 }
  }));
});
let failed = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name); if (!cond) failed++; };
const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('filii_abyssi_state_v15')));
const hp = async n => Number((await st()).creatures.find(c => c.name === n)?.hp);
const wait = ms => page.waitForTimeout(ms);
const card = n => page.locator('.combat-monster-card', { hasText: new RegExp(`^[\\s\\S]*${n}(?!\\s*\\d)`) }).first();

await page.goto(base); await wait(1500);
// --- aba Monstros
await page.evaluate(() => document.querySelector('[data-nav="master"]')?.click()); await wait(400);
await page.evaluate(() => document.querySelector('.panel-tabs [data-tab="monsters"]')?.click()); await wait(400);
const bank = n => page.locator('.monster-bank-card', { hasText: n }).first();
await bank('Zumbi').locator('[data-delta="-5"]').click(); await wait(250);
await bank('Zumbi').locator('[data-delta="-5"]').click(); await wait(250);
ok('banco: −5 duas vezes (re-render) → 10', await hp('Zumbi') === 10);
await bank('Cultista').locator('[data-delta="-5"]').click(); await wait(250);
ok('banco: vida salva como texto "12" −5 → 7', await hp('Cultista') === 7);
await bank('Zumbi').locator('[data-dup-m]').click(); await wait(400);
ok('banco: duplicar → Zumbi 2', (await st()).creatures.some(c => c.name === 'Zumbi 2'));
await bank('Zumbi 2').locator('[data-del-m]').click(); await wait(400);
ok('banco: excluir', !(await st()).creatures.some(c => c.name === 'Zumbi 2'));

// --- combate
await page.evaluate(() => document.querySelector('[data-nav="home"]')?.click()); await wait(500);
await page.click('#combatAddMonster'); await wait(250);
await page.locator('[data-add-combat-monster="m1"]').click(); await wait(500);
ok('combate: Zumbi entrou', await page.locator('.combat-monster-card').count() === 1);
await page.locator('.combat-monster-card [data-delta="-5"]').click(); await wait(400);
ok('combate: −5 (10→5)', await hp('Zumbi') === 5);
await page.fill('[data-combat-monster-amount]', '3'); await page.locator('[data-combat-monster-apply][data-sign="-1"]').click(); await wait(400);
ok('combate: dano livre 3 (5→2)', await hp('Zumbi') === 2);
await page.locator('[data-combat-monster-undo]').click(); await wait(400);
ok('combate: desfazer (→5)', await hp('Zumbi') === 5);
await page.fill('[data-combat-monster-amount]', '99'); await page.locator('[data-combat-monster-apply][data-sign="-1"]').click(); await wait(400);
ok('combate: dano livre derruba (→0) e mostra CAÍDO', await hp('Zumbi') === 0 && /CAÍDO/.test(await page.locator('.combat-monster-card').innerText()));
await page.locator('[data-combat-monster-atk]').click(); await wait(150);
ok('combate: 🎲 Atacar', /ataca/.test(await page.locator('#toast-root').innerText()));
await page.locator('[data-combat-monster-hide]').click(); await wait(400);
ok('combate: ocultar dos players', (await st()).combatSession.participants.find(p => p.kind === 'monster').hidden === true);
await page.locator('[data-combat-monster-hide]').click(); await wait(400);
ok('combate: revelar', (await st()).combatSession.participants.find(p => p.kind === 'monster').hidden === false);
// pular caído
await page.click('#combatStart'); await wait(400);
ok('combate: começa em quem está de pé (Zeck)', (await st()).combatSession.currentKey === 'player:p1');
await page.click('#combatNext'); await wait(500);
const cs = (await st()).combatSession;
ok('combate: Zumbi caído é pulado (continua em Zeck, rodada 2)', cs.currentKey === 'player:p1' && cs.round === 2);
// cópias ×3
await page.click('#combatAddMonster'); await wait(250);
await page.fill('#combatCopyQty', '3'); await page.locator('[data-add-combat-monster-copy="m2"]').click(); await wait(600);
const names = (await st()).creatures.map(c => c.name);
ok('cópias ×3: Cultista 2,3,4 (' + names.join(',') + ')', ['Cultista 2', 'Cultista 3', 'Cultista 4'].every(n => names.includes(n)));
ok('cópias ×3: todas no combate', (await st()).combatSession.participants.filter(p => p.kind === 'monster').length === 4);
// iniciativa
await page.click('#combatRollMonsterInit'); await wait(500);
const mons = (await st()).combatSession.participants.filter(p => p.kind === 'monster');
ok('iniciativa dos monstros rolada (1–20)', mons.every(m => m.initiative >= 1 && m.initiative <= 20));
const ordered = (await st()).combatSession.participants.slice().sort((a, b) => a.turnOrder - b.turnOrder).filter(p => p.kind === 'monster').map(p => p.initiative);
ok('ordem: monstros em ordem decrescente de iniciativa', ordered.every((v, i) => i === 0 || ordered[i - 1] >= v));
await page.screenshot({ path: 'monster-ui.png', fullPage: true });
ok('sem erros de página', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
process.exit(failed ? 1 : 0);
