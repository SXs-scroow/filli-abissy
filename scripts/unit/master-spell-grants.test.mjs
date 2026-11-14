import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

test('Mestre tem ação direta de magias em cada ficha da Central de personagens', () => {
  assert.match(app, /data-grant-spells="\$\{esc\(p\.id\)\}"/);
  assert.match(app, /document\.querySelectorAll\('\[data-grant-spells\]'\)/);
});

test('modal lista somente magias existentes no grimório da campanha', () => {
  assert.match(app, /function openPlayerSpellGrantModal\(playerId\)/);
  assert.match(app, /const spells=getSpells\(\)/);
  assert.match(app, /data-player-grant-spell=/);
});

test('concessão usa grantedSpells e preserva magia inicial e magias pessoais', () => {
  assert.match(app, /p\.grantedSpells=nextList/);
  assert.match(app, /if\(box\.disabled\)return/);
  assert.match(app, /const previousStamp=p\._syncUpdatedAt/);
  assert.match(app, /p\.grantedSpells=previous;p\._syncUpdatedAt=previousStamp/);
});

test('concessões remotas são confirmadas pelo armazenamento de Players antes de anunciar sincronização', () => {
  assert.match(app, /const rows=await upsertPlayers\(\[p\]\)/);
  assert.match(app, /CONCESSAO_NAO_CONFIRMADA/);
  assert.match(app, /sincronização remota indisponível/);
});
