// Executa o refreshMasterPlayersAdminView REAL com um DOM falso para garantir que a aba Players
// só é reconstruída quando algo mudou de verdade (e não a cada sincronização).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { extractFunction } from '../chaos/extract-app.mjs';

const src = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

function setup() {
  const dom = { replaced: 0, statusText: '' };
  const status = { set textContent(v) { dom.statusText = v; } };
  const box = {
    scrollTop: 0, style: {},
    getBoundingClientRect: () => ({ height: 100 }),
    contains: () => false,
    querySelector: sel => (box.hasCard && sel.includes('players-admin-card') ? {} : null),
    set innerHTML(v) { dom.replaced++; box.hasCard = true; box.html = v; }, get innerHTML() { return box.html; }
  };
  const ctx = vm.createContext({
    Math, clearTimeout, setTimeout, requestAnimationFrame: f => f(),
    window: { scrollY: 0, scrollTo() {} },
    document: { hidden: false, activeElement: null, getElementById: id => (id === 'adminContent' ? box : id === 'playerSyncStatus' ? status : null) },
    state: { session: { role: 'master' } }, currentView: 'master', adminTabCurrent: 'players',
    bindAdminContent() {},
    roster: 'A,B', syncTime: '10:00:00',
    playersAdmin() { return `<div class="card players-admin-card"><p id="playerSyncStatus">Última sincronização: ${ctx.syncTime}</p><ul>${ctx.roster}</ul></div>`; }
  });
  vm.runInContext(`let masterPlayersRefreshTimer=0;\n${extractFunction(src, 'refreshMasterPlayersAdminView')}\nglobalThis.refresh=refreshMasterPlayersAdminView;`, ctx);
  return { ctx, dom, box };
}

test('primeira chamada desenha a aba', () => {
  const { ctx, dom } = setup();
  ctx.refresh();
  assert.equal(dom.replaced, 1);
});

test('só o horário da sincronização mudou: NÃO reconstrói, só atualiza o texto', () => {
  const { ctx, dom } = setup();
  ctx.refresh();
  ctx.syncTime = '10:01:00';
  ctx.refresh(); ctx.refresh();
  assert.equal(dom.replaced, 1, 'reconstruiu sem necessidade (flick)');
  assert.equal(dom.statusText, 'Última sincronização: 10:01:00');
});

test('quando uma ficha muda de verdade, reconstrói', () => {
  const { ctx, dom } = setup();
  ctx.refresh();
  ctx.roster = 'A,B,C';
  ctx.refresh();
  assert.equal(dom.replaced, 2);
});

test('se a aba foi trocada (sem o card de Players no DOM), reconstrói mesmo com o mesmo HTML', () => {
  const { ctx, dom, box } = setup();
  ctx.refresh();
  box.hasCard = false;
  ctx.refresh();
  assert.equal(dom.replaced, 2);
});

test('não mexe no DOM com modal de edição aberto', () => {
  const { ctx, dom } = setup();
  ctx.document.getElementById = id => (id === 'entityModal' ? {} : null);
  ctx.refresh();
  assert.equal(dom.replaced, 0);
});
