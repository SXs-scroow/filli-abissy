import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('a sessão mantém apenas os Players explicitamente escolhidos', () => {
  assert.match(app, /for\(const row of old\.values\(\)\)\{\s*if\(row\.kind!=='player'\)continue;/);
  assert.doesNotMatch(app, /for\(const p of \(state\.players\|\|\[\]\)\)\{\s*const key=combatParticipantKey\('player'/);
  assert.match(app, /const selected=new Set\(Array\.from\(selectedIds\|\|\[\],x=>String\(x\)\)\)/);
});

test('o Mestre pode incluir ou retirar Players sem apagar as fichas', () => {
  assert.match(app, /data-combat-toggle-player=/);
  assert.match(app, /document\.querySelectorAll\('\[data-combat-toggle-player\]'\)/);
  assert.match(app, /Player retirado da sessão; a ficha foi preservada\./);
  assert.match(app, /const list=row\.kind==='monster'\?state\.creatures:state\.players/);
  assert.match(app, /if\(!entry\)\{if\(!source\)return;entry=buildCombatSessionParticipants/);
});

test('a ordem de turno só inclui participantes habilitados', () => {
  assert.match(app, /function combatOrderedParticipants\(c=normalizeCombatParticipants\(\)\)\{\s*return \[\.\.\.\(c\.participants\|\|\[\]\)\]\s*\.filter\(x=>x\.enabled!==false\)/);
  assert.match(app, /ordered\.forEach\(\(entry,index\)=>\{entry\.turnOrder=index\}\)/);
});

test('Nova sessão cria ID novo, zera o encontro e abre o seletor de Players', () => {
  assert.match(app, /function combatNewSession\(\)\{return \{\.\.\.defaultCombatSession\(\),sessionId:cryptoRandomId\('combat'\),updatedAt:Date\.now\(\)\}\}/);
  assert.match(app, /id="combatNewSession"/);
  assert.match(app, /document\.getElementById\('combatNewSession'\)\?\.addEventListener\('click',openCombatNewSessionPicker\)/);
  assert.match(app, /id="combatNewSessionModal"/);
  assert.match(app, /fresh\.participants=buildCombatSessionParticipants\(players,selected\)/);
  assert.doesNotMatch(app, /fresh\.participants=\(state\.players\|\|\[\]\)\.map/);
});
