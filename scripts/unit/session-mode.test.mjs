import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../../src/playerStore.js', import.meta.url), 'utf8');

test('Modo Sessão: botão no menu só para o Mestre e roteamento da view', () => {
  assert.match(app, /master\?`<button data-nav="session"/);
  assert.match(app, /view==='session'&&state\.session\.role==='master'\?sessionModePage\(\)/);
  assert.match(app, /view==='session'&&state\.session\?\.role==='master'\)bindSessionMode\(\)/);
});

test('Modo Sessão: atualizações remotas de players, combate, monstros e música re-renderizam a view', () => {
  assert.match(app, /view==='session'&&role==='master'\)\{\s*needed=new Set\(\['players','combatSession','creatures','music'\]\)/);
});

test('presença: todos (Mestre e Players) entram no mesmo canal e o papel é enviado ao servidor', () => {
  assert.match(store, /subscribePlayerPresence\(sessionId, playerId, callback, \{ role = 'player' \} = \{\}\)/);
  assert.equal((store.match(/channel\.track\(\{playerId:String\(playerId\),role,lastSeen:Date\.now\(\)\}\)/g) || []).length, 2);
  assert.match(app, /subscribePlayerPresence\('main',myId,applyPresenceState/);
  assert.match(app, /nexusHandleLive\(msg\);\}\);\s*startPresence\(\);/);
});

test('Modo Sessão reaproveita os handlers de combate e permanece na própria tela', () => {
  assert.match(app, /function renderCombatView\(\)\{render\(currentView==='session'\?'session':'home'\)\}/);
  const combatCode = app.slice(app.indexOf('async function persistCombat('), app.indexOf('async function openSessionPuzzleManager('));
  assert.doesNotMatch(combatCode.replace(/function renderCombatView[^\n]*\n/, ''), /render\('home'\)/, 'handlers de combate não podem forçar a volta ao Início');
  for (const id of ['combatStart', 'combatNext', 'combatRollMonsterInit', 'combatAddMonster', 'masterSendSecret', 'masterMusicPlay', 'openSessionPuzzleManager', 'rollsFeed', 'data-sm-step']) {
    assert.ok(app.includes(id), id);
  }
});
