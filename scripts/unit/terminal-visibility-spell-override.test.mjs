import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20261118090000_session_puzzle_master_visibility.sql', import.meta.url), 'utf8');

test('Mestre controla visibilidade dos terminais; Player recebe apenas os visíveis', () => {
  assert.match(app, /id="spVisibleToPlayers"/);
  assert.match(app, /visibleToPlayers:document\.getElementById\('spVisibleToPlayers'\)\.checked/);
  assert.match(app, /visibleToPlayers!==false/);
  assert.match(migration, /add column if not exists visible_to_players boolean not null default true/i);
  assert.match(migration, /and is_active and visible_to_players/i);
  assert.match(migration, /visible_to_players = excluded\.visible_to_players/i);
});

test('magia pode ser usada com Sanidade insuficiente e alerta o Mestre sobre consequências', () => {
  const start = app.indexOf('function castSpell(');
  const end = app.indexOf('\nfunction themeIsAudio', start);
  assert.ok(start >= 0 && end > start);
  const cast = app.slice(start, end);
  assert.doesNotMatch(cast, /if\s*\(cost\s*>\s*current\)/);
  assert.match(cast, /a magia ainda poderá ser usada/i);
  assert.match(cast, /p\.sanity=clamp\(current-cost,0,max\)/);
});

test('Mestre pode ultrapassar o limite total de alocação sem remover a proteção dos Players', () => {
  assert.match(app, /state\.session\?\.role==='master'\?999:MAX_ATTR/);
  assert.match(app, /state\.session\?\.role==='master'\?999:MAX_SKILL/);
  assert.match(app, /isMaster\?Math\.max\(0,Math\.min\(Math\.floor\(capped\),g\.max\)\):allowedPointValue/);
});
