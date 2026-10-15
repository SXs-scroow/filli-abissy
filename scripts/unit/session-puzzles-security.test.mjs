import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const sync = readFileSync(new URL('../../src/globalSync.js', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../../supabase/migrations/20261014120000_session_puzzles.sql', import.meta.url), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `não encontrou início: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `não encontrou fim: ${end}`);
  return source.slice(a, b);
}

test('puzzles usam RPCs privadas e não são inseridos no JSON global do jogo', () => {
  for (const name of ['listSessionPuzzles', 'saveSessionPuzzle', 'deleteSessionPuzzle', 'unlockSessionPuzzle', 'getSessionMasterNotes', 'saveSessionMasterNotes']) {
    assert.match(sync, new RegExp(`export async function ${name}\\(`));
  }
  assert.match(app, /data-puzzle-unlock-form/);
  assert.match(app, /await unlockSessionPuzzle\(/);
  assert.match(app, /function terminalFileWindowMarkup\(p,unlocked,opened\)/);
  assert.match(app, /decodeAshenDesktopContent\(unlocked\.content\|\|''\)/);
  assert.match(app, /decoded\.config\?\.corrupted/);
  assert.match(app, /<pre>\$\{esc\(body\)\}<\/pre>/);
  assert.match(app, /unlocked\?terminalDesktopMarkup\(p,unlocked\):terminalLoginMarkup\(p\)/);
  assert.match(app, /primeTerminalAudio\(\)/);
  assert.match(app, /playTerminalBootSound\(\)/);
  assert.match(sql, /create table if not exists public\.a_profecia_session_puzzles/);
  assert.match(sql, /alter table public\.a_profecia_session_puzzles enable row level security/);
  assert.match(sql, /revoke all on table public\.a_profecia_session_puzzles from public, anon, authenticated/);
});

test('retorno para jogadores não inclui login, hash ou conteúdo secreto', () => {
  const playerList = between(sql, "  select coalesce(jsonb_agg(jsonb_build_object(\n    'id', puzzle_id, 'title', title, 'terminalLabel', terminal_label,\n    'prompt', prompt, 'hint', hint, 'active', is_active", "  return result;\nend\n$function$;");
  assert.doesNotMatch(playerList, /loginName|login_name|password_hash|fileContent|file_content/);
  const masterList = between(sql, "if s.role = 'master' then", "end if;\n\n  select coalesce(jsonb_agg(jsonb_build_object(");
  assert.match(masterList, /'loginName', login_name/);
  assert.match(masterList, /'fileContent', file_content/);
  assert.doesNotMatch(masterList, /'password'\s*,\s*password_hash/);
});

test('somente o Mestre grava/apaga puzzles e acessa notas privadas', () => {
  for (const fn of ['a_profecia_session_puzzle_save', 'a_profecia_session_puzzle_delete', 'a_profecia_session_master_notes_get', 'a_profecia_session_master_notes_save']) {
    const body = between(sql, `function public.${fn}`, '$function$;');
    assert.match(body, /s\.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'/, `${fn} precisa validar papel do Mestre`);
  }
  assert.match(sql, /is_note boolean not null default false/);
  assert.match(sql, /where session_id = sid and puzzle_id = '__master_notes__' and is_note/);
});

test('desbloqueio exige Player, sessão ativa e credenciais validadas no servidor', () => {
  const body = between(sql, 'function public.a_profecia_session_puzzle_unlock', '$function$;');
  assert.match(body, /s\.role is distinct from 'player' then raise exception 'NAO_AUTORIZADO'/);
  assert.match(body, /current_sid <> sid/);
  assert.match(body, /crypt\(coalesce\(p_password, ''\), rec\.password_hash\)/);
  assert.match(body, /failed_attempts >= 8/);
  assert.match(body, /return jsonb_build_object\('ok', true, 'title', rec\.file_title, 'content', rec\.file_content/);
  assert.match(body, /return jsonb_build_object\('ok', false/);
});

test('jogador só pode consultar terminais da sessão atualmente ativa', () => {
  const body = between(sql, 'function public.a_profecia_session_puzzles_list', '$function$;');
  assert.match(body, /if s\.role = 'player' then[\s\S]*?current_sid <> sid/);
  assert.match(body, /where session_id = sid and not is_note and is_active/);
});

test('painel de combate inclui ações rápidas e marcações temporárias', () => {
  assert.match(app, /function openCombatStatusEditor\(/);
  assert.match(app, /function tickSessionEffects\(/);
  assert.match(app, /data-combat-player-action/);
  assert.match(app, /sessionEffects/);
  assert.match(app, /openSessionPuzzleManager/);
  assert.match(app, /openSessionMasterNotes/);
  assert.match(app, /\['puzzles','Terminais'\]/);
  assert.doesNotMatch(app, /immersivePuzzleLoadSession/);
  assert.match(app, /String\(state\.combatSession\?\.sessionId\|\|''\)===sid/);
  assert.match(app, /const unlockSessionId=String\(state\.combatSession\?\.sessionId\|\|''\)/);
  assert.match(app, /let immersivePuzzleOwnerId=''/);
  assert.match(app, /function clearImmersivePuzzleState\(\)/);
  assert.match(app, /clearImmersivePuzzleState\(\);state\.session=null;clearSessionCache\(\)/);
  assert.match(app, /immersivePuzzleOwnerId!==ownerId/);
  assert.match(app, /unlockOwnerId/);
});


test('RPCs de puzzles incluem permissões para a chave pública e recarregam o cache de esquema', () => {
  for (const fn of [
    'a_profecia_session_puzzles_list', 'a_profecia_session_puzzle_save',
    'a_profecia_session_puzzle_delete', 'a_profecia_session_puzzle_unlock',
    'a_profecia_session_master_notes_get', 'a_profecia_session_master_notes_save'
  ]) {
    assert.match(sql, new RegExp(`grant execute on function public\.${fn}\([^;]+\) to anon;`), `${fn} precisa estar acessível para RPC autenticada pelo token de aplicação`);
  }
  assert.match(sql, /notify pgrst, 'reload schema'/);
});

test('cliente interrompe novas chamadas quando PostgREST confirma RPC ausente', () => {
  assert.match(sync, /const SESSION_PUZZLE_RPCS = new Set/);
  assert.match(sync, /let sessionPuzzleSchemaUnavailable = false/);
  assert.match(sync, /SESSION_PUZZLE_RPCS\.has\(name\) && sessionPuzzleSchemaUnavailable/);
  assert.match(sync, /sessionPuzzleSchemaUnavailable = true/);
});
