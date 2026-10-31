import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20261027120000_session_puzzles_repair.sql', import.meta.url), 'utf8');
const realtime = readFileSync(new URL('../../supabase/migrations/20261027110000_player_realtime_repair.sql', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('consolidated puzzle repair keeps base, audio and corrupted-file schemas in order', () => {
  assert.match(migration, /add column if not exists audio_files jsonb/i);
  assert.match(migration, /add column if not exists extra_files jsonb/i);
  assert.match(migration, /add column if not exists file_corruption jsonb/i);
  assert.match(migration, /function public\.a_profecia_session_puzzle_unlock/);
  assert.match(migration, /crypt\(coalesce\(p_password, ''\), rec\.password_hash\)/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(migration, /drop table|truncate table/i);
});

test('Realtime repair only recreates the trigger and publishes the app expected topic/event', () => {
  assert.match(realtime, /realtime\.send\(/);
  assert.match(realtime, /'player-changed'/);
  assert.match(realtime, /'a-profecia-players-events'/);
  assert.match(realtime, /drop trigger if exists a_profecia_players_realtime/);
  assert.doesNotMatch(realtime, /delete from public\.a_profecia_players|truncate table|drop table/i);
});

test('puzzle editor keeps data unless the server confirms read-after-write', () => {
  assert.match(app, /if\(!savedRow\)throw new Error\('PUZZLE_SAVE_NOT_CONFIRMED'\)/);
  assert.match(app, /Seus dados continuam no editor; tente novamente/);
  assert.match(app, /JSON\.stringify\(data\.audioFiles\)\.length>3200000/);
});
