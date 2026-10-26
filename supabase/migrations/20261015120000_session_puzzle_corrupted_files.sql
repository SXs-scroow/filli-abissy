-- Ashen Testimony V1.5.34: arquivos adicionais e arquivos corrompidos nos terminais.
-- Adição compatível: não apaga puzzles existentes, credenciais, áudios nem fichas.
-- Pré-requisito: a migração 20261015054816_session_puzzle_audio_20261015.sql já aplicada.
--
-- Corrupção:
--   * arquivo principal:  file_corruption = {corrupted, level, shown}
--   * arquivos extras:    extra_files     = [{id,name,folder,content,corrupted,level,shown}]
--   * gravações:          audio_files[i].corrupted + corruptMode ('glitch' | 'dead')
-- O jogador só recebe a versão corrompida ('shown'); o 'content' original e o áudio 'dead' não saem do servidor.

alter table public.a_profecia_session_puzzles add column if not exists extra_files jsonb not null default '[]'::jsonb;
alter table public.a_profecia_session_puzzles add column if not exists file_corruption jsonb not null default '{}'::jsonb;

create or replace function public.a_profecia_session_puzzles_list(p_token text, p_session_id text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  sid text := left(trim(coalesce(p_session_id, '')), 180);
  current_sid text;
  result jsonb;
begin
  s := public.a_profecia_auth(p_token);
  if sid = '' then raise exception 'SESSAO_PUZZLE_INVALIDA'; end if;
  if s.role is distinct from 'master' and s.role is distinct from 'player' then
    raise exception 'NAO_AUTORIZADO';
  end if;
  if s.role = 'player' then
    select data->'combatSession'->>'sessionId' into current_sid
      from public.a_profecia_global where id = 'main';
    if current_sid is null or current_sid <> sid then raise exception 'SESSAO_PUZZLE_EXPIRADA'; end if;
  end if;
  if s.role = 'master' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', puzzle_id, 'title', title, 'terminalLabel', terminal_label,
      'prompt', prompt, 'hint', hint, 'loginName', login_name,
      'fileTitle', file_title, 'fileContent', file_content,
      'audioFiles', audio_files, 'extraFiles', extra_files, 'fileCorruption', file_corruption,
      'active', is_active, 'hasPassword', (password_hash <> ''),
      'updatedAt', updated_at
    ) order by created_at), '[]'::jsonb)
    into result from public.a_profecia_session_puzzles
    where session_id = sid and not is_note;
    return result;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', puzzle_id, 'title', title, 'terminalLabel', terminal_label,
    'prompt', prompt, 'hint', hint, 'active', is_active
  ) order by created_at), '[]'::jsonb)
  into result from public.a_profecia_session_puzzles
  where session_id = sid and not is_note and is_active;
  return result;
end
$function$;

create or replace function public.a_profecia_session_puzzle_save(p_token text, p_session_id text, p_puzzle jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  sid text := left(trim(coalesce(p_session_id, '')), 180);
  pid text := left(trim(coalesce(p_puzzle->>'id', '')), 180);
  ttl text := left(trim(coalesce(p_puzzle->>'title', '')), 160);
  terminal text := left(trim(coalesce(p_puzzle->>'terminalLabel', 'TERMINAL OFFLINE')), 100);
  pr text := left(coalesce(p_puzzle->>'prompt', ''), 6000);
  hi text := left(coalesce(p_puzzle->>'hint', ''), 2000);
  uname text := left(trim(coalesce(p_puzzle->>'loginName', '')), 160);
  pw text := coalesce(p_puzzle->>'password', '');
  ft text := left(trim(coalesce(p_puzzle->>'fileTitle', 'Arquivo recuperado')), 180);
  fc text := left(coalesce(p_puzzle->>'fileContent', ''), 30000);
  audio_list jsonb := coalesce(p_puzzle->'audioFiles', '[]'::jsonb);
  audio_item jsonb;
  extra_list jsonb := coalesce(p_puzzle->'extraFiles', '[]'::jsonb);
  extra_item jsonb;
  extra_clean jsonb;
  corr jsonb := coalesce(p_puzzle->'fileCorruption', '{}'::jsonb);
  corr_on boolean;
  corr_level text;
  corr_shown text;
  active_flag boolean := coalesce((p_puzzle->>'active')::boolean, true);
  old_hash text;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if sid = '' or pid = '' or pid = '__master_notes__' then raise exception 'SESSAO_PUZZLE_INVALIDA'; end if;
  if ttl = '' or uname = '' or pr = '' or fc = '' then raise exception 'CAMPOS_PUZZLE_OBRIGATORIOS'; end if;
  if length(pw) > 128 or length(coalesce(p_puzzle->>'loginName','')) > 160 then raise exception 'SENHA_PUZZLE_INVALIDA'; end if;
  if jsonb_typeof(audio_list) is distinct from 'array' then raise exception 'AUDIO_PUZZLE_INVALIDO'; end if;
  if jsonb_array_length(audio_list) > 3 or length(audio_list::text) > 3300000 then raise exception 'AUDIO_PUZZLE_INVALIDO'; end if;
  for audio_item in select value from jsonb_array_elements(audio_list) loop
    if coalesce(audio_item->>'name','') = '' or length(coalesce(audio_item->>'name','')) > 180
       or coalesce(audio_item->>'type','') not like 'audio/%'
       or left(coalesce(audio_item->>'dataUrl',''), 11) <> 'data:audio/'
       or position(';base64,' in coalesce(audio_item->>'dataUrl','')) = 0
       or length(coalesce(audio_item->>'dataUrl','')) > 1100000 then
      raise exception 'AUDIO_PUZZLE_INVALIDO';
    end if;
  end loop;

  -- V1.5.34: modo de corrupção opcional por gravação.
  for audio_item in select value from jsonb_array_elements(audio_list) loop
    if coalesce(audio_item->>'corrupted', 'false') not in ('true', 'false')
       or coalesce(audio_item->>'corruptMode', 'glitch') not in ('glitch', 'dead') then
      raise exception 'AUDIO_PUZZLE_INVALIDO';
    end if;
  end loop;

  -- V1.5.34: arquivos adicionais (texto) e corrupção do arquivo principal.
  if jsonb_typeof(extra_list) is distinct from 'array'
     or jsonb_array_length(extra_list) > 12
     or length(extra_list::text) > 600000 then
    raise exception 'ARQUIVOS_PUZZLE_INVALIDOS';
  end if;
  for extra_item in select value from jsonb_array_elements(extra_list) loop
    if jsonb_typeof(extra_item) is distinct from 'object'
       or length(coalesce(extra_item->>'id', '')) not between 1 and 80
       or length(trim(coalesce(extra_item->>'name', ''))) not between 1 and 120
       or coalesce(extra_item->>'folder', '') not in ('evidence', 'documents', 'records', 'system', 'root')
       or length(coalesce(extra_item->>'content', '')) > 20000
       or length(coalesce(extra_item->>'shown', '')) > 24000
       or coalesce(nullif(extra_item->>'level', ''), 'partial') not in ('partial', 'severe', 'total')
       or coalesce(extra_item->>'corrupted', 'false') not in ('true', 'false') then
      raise exception 'ARQUIVOS_PUZZLE_INVALIDOS';
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e->>'id',
      'name', trim(e->>'name'),
      'folder', e->>'folder',
      'content', coalesce(e->>'content', ''),
      'corrupted', (coalesce(e->>'corrupted', 'false') = 'true'),
      'level', coalesce(nullif(e->>'level', ''), 'partial'),
      'shown', case when coalesce(e->>'corrupted', 'false') = 'true' then coalesce(e->>'shown', '') else '' end
    ) order by ord), '[]'::jsonb)
    into extra_clean
    from jsonb_array_elements(extra_list) with ordinality as t(e, ord);

  corr_on := coalesce(corr->>'corrupted', 'false') = 'true';
  corr_level := coalesce(nullif(corr->>'level', ''), 'partial');
  corr_shown := left(coalesce(corr->>'shown', ''), 30000);
  if corr_level not in ('partial', 'severe', 'total') or (corr_on and corr_shown = '') then
    raise exception 'ARQUIVOS_PUZZLE_INVALIDOS';
  end if;

  select password_hash into old_hash from public.a_profecia_session_puzzles
    where session_id = sid and puzzle_id = pid and not is_note;
  if pw = '' and coalesce(old_hash, '') = '' then raise exception 'SENHA_PUZZLE_OBRIGATORIA'; end if;

  insert into public.a_profecia_session_puzzles(
    session_id, puzzle_id, title, terminal_label, prompt, hint, login_name,
    password_hash, file_title, file_content, audio_files, extra_files, file_corruption, is_active, is_note, updated_at
  ) values (
    sid, pid, ttl, terminal, pr, hi, uname,
    case when pw <> '' then crypt(pw, gen_salt('bf', 10)) else coalesce(old_hash, '') end,
    ft, fc, audio_list, extra_clean,
    jsonb_build_object('corrupted', corr_on, 'level', corr_level, 'shown', case when corr_on then corr_shown else '' end),
    active_flag, false, now()
  ) on conflict (session_id, puzzle_id) do update set
    title = excluded.title,
    terminal_label = excluded.terminal_label,
    prompt = excluded.prompt,
    hint = excluded.hint,
    login_name = excluded.login_name,
    password_hash = case when pw <> '' then excluded.password_hash else public.a_profecia_session_puzzles.password_hash end,
    file_title = excluded.file_title,
    file_content = excluded.file_content,
    audio_files = excluded.audio_files,
    extra_files = excluded.extra_files,
    file_corruption = excluded.file_corruption,
    is_active = excluded.is_active,
    is_note = false,
    updated_at = now();
  return jsonb_build_object('saved', true, 'id', pid, 'updatedAt', clock_timestamp());
end
$function$;

create or replace function public.a_profecia_session_puzzle_unlock(
  p_token text, p_session_id text, p_puzzle_id text, p_login text, p_password text
) returns jsonb language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  sid text := left(trim(coalesce(p_session_id, '')), 180);
  pid text := left(trim(coalesce(p_puzzle_id, '')), 180);
  current_sid text;
  rec public.a_profecia_session_puzzles;
  attempts public.a_profecia_session_puzzle_attempts;
  failures integer;
  audio_out jsonb;
  extra_out jsonb;
  main_corrupt boolean;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'player' then raise exception 'NAO_AUTORIZADO'; end if;
  if sid = '' or pid = '' or coalesce(s.player_id, '') = '' then raise exception 'SESSAO_PUZZLE_INVALIDA'; end if;
  if length(coalesce(p_login,'')) > 160 or length(coalesce(p_password,'')) > 128 then
    return jsonb_build_object('ok', false, 'locked', false, 'message', 'Credenciais recusadas.');
  end if;

  select data->'combatSession'->>'sessionId' into current_sid
    from public.a_profecia_global where id = 'main';
  if current_sid is null or current_sid <> sid then raise exception 'SESSAO_PUZZLE_EXPIRADA'; end if;

  select * into rec from public.a_profecia_session_puzzles
   where session_id = sid and puzzle_id = pid and not is_note and is_active;
  if not found then raise exception 'PUZZLE_NAO_ENCONTRADO'; end if;

  select * into attempts from public.a_profecia_session_puzzle_attempts
   where session_id = sid and puzzle_id = pid and player_id = s.player_id;
  if found and attempts.failed_attempts >= 8 and attempts.window_started_at > now() - interval '5 minutes' then
    return jsonb_build_object('ok', false, 'locked', true, 'message', 'O terminal bloqueou novas tentativas por alguns minutos.');
  end if;

  if lower(trim(coalesce(p_login, ''))) <> lower(rec.login_name)
     or rec.password_hash = ''
     or crypt(coalesce(p_password, ''), rec.password_hash) <> rec.password_hash then
    insert into public.a_profecia_session_puzzle_attempts(session_id, puzzle_id, player_id, failed_attempts, window_started_at)
      values(sid, pid, s.player_id, 1, now())
      on conflict (session_id, puzzle_id, player_id) do update set
        failed_attempts = case when public.a_profecia_session_puzzle_attempts.window_started_at <= now() - interval '5 minutes'
          then 1 else public.a_profecia_session_puzzle_attempts.failed_attempts + 1 end,
        window_started_at = case when public.a_profecia_session_puzzle_attempts.window_started_at <= now() - interval '5 minutes'
          then now() else public.a_profecia_session_puzzle_attempts.window_started_at end
      returning failed_attempts into failures;
    if failures >= 8 then
      return jsonb_build_object('ok', false, 'locked', true, 'message', 'Muitas tentativas. O terminal ficará bloqueado por cinco minutos.');
    end if;
    return jsonb_build_object('ok', false, 'locked', false, 'message', 'Credenciais recusadas.');
  end if;

  delete from public.a_profecia_session_puzzle_attempts
   where session_id = sid and puzzle_id = pid and player_id = s.player_id;
  -- V1.5.34: conteúdo original de itens corrompidos nunca sai do servidor.
  select coalesce(jsonb_agg(
      case when coalesce(a->>'corrupted', 'false') = 'true' and coalesce(a->>'corruptMode', 'glitch') = 'dead'
           then a - 'dataUrl' else a end
      order by ord), '[]'::jsonb)
    into audio_out
    from jsonb_array_elements(rec.audio_files) with ordinality as t(a, ord);
  select coalesce(jsonb_agg(
      case when coalesce(e->>'corrupted', 'false') = 'true' then e - 'content' else e end
      order by ord), '[]'::jsonb)
    into extra_out
    from jsonb_array_elements(rec.extra_files) with ordinality as t(e, ord);
  main_corrupt := coalesce(rec.file_corruption->>'corrupted', 'false') = 'true';
  return jsonb_build_object(
    'ok', true,
    'title', rec.file_title,
    'content', case when main_corrupt then coalesce(rec.file_corruption->>'shown', '') else rec.file_content end,
    'puzzleTitle', rec.title,
    'audioFiles', audio_out,
    'extraFiles', extra_out,
    'fileCorruption', case when main_corrupt
      then jsonb_build_object('corrupted', true, 'level', coalesce(rec.file_corruption->>'level', 'partial')) else null end
  );
end
$function$;

revoke all on function public.a_profecia_session_puzzles_list(text,text) from public, authenticated;
revoke all on function public.a_profecia_session_puzzle_save(text,text,jsonb) from public, authenticated;
revoke all on function public.a_profecia_session_puzzle_unlock(text,text,text,text,text) from public, authenticated;
grant execute on function public.a_profecia_session_puzzles_list(text,text) to anon;
grant execute on function public.a_profecia_session_puzzle_save(text,text,jsonb) to anon;
grant execute on function public.a_profecia_session_puzzle_unlock(text,text,text,text,text) to anon;

-- Atualiza o cache de funções RPC do PostgREST assim que a migração for aplicada.
notify pgrst, 'reload schema';
