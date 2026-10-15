-- Ashen Testimony V1.5.32: terminais, notas privadas e anexos de áudio.
-- Adição compatível: não apaga puzzles existentes nem altera as credenciais.
-- Dados de solução/arquivos não ficam no JSON global compartilhado.
create table if not exists public.a_profecia_session_puzzles (
  session_id text not null,
  puzzle_id text not null,
  title text not null default 'Terminal abandonado',
  terminal_label text not null default 'TERMINAL OFFLINE',
  prompt text not null default '',
  hint text not null default '',
  login_name text not null default '',
  password_hash text not null default '',
  file_title text not null default 'Arquivo recuperado',
  file_content text not null default '',
  audio_files jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  is_note boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, puzzle_id),
  check (length(session_id) between 1 and 180),
  check (length(puzzle_id) between 1 and 180),
  check (length(title) <= 160),
  check (length(terminal_label) <= 100),
  check (length(prompt) <= 6000),
  check (length(hint) <= 2000),
  check (length(login_name) <= 160),
  check (length(password_hash) <= 200),
  check (length(file_title) <= 180),
  check (length(file_content) <= 30000)
);

alter table public.a_profecia_session_puzzles add column if not exists audio_files jsonb not null default '[]'::jsonb;

create table if not exists public.a_profecia_session_puzzle_attempts (
  session_id text not null,
  puzzle_id text not null,
  player_id text not null,
  window_started_at timestamptz not null default now(),
  failed_attempts integer not null default 0,
  primary key (session_id, puzzle_id, player_id)
);

alter table public.a_profecia_session_puzzles enable row level security;
alter table public.a_profecia_session_puzzle_attempts enable row level security;
revoke all on table public.a_profecia_session_puzzles from public, anon, authenticated;
revoke all on table public.a_profecia_session_puzzle_attempts from public, anon, authenticated;

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
      'audioFiles', audio_files, 'active', is_active, 'hasPassword', (password_hash <> ''),
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

  select password_hash into old_hash from public.a_profecia_session_puzzles
    where session_id = sid and puzzle_id = pid and not is_note;
  if pw = '' and coalesce(old_hash, '') = '' then raise exception 'SENHA_PUZZLE_OBRIGATORIA'; end if;

  insert into public.a_profecia_session_puzzles(
    session_id, puzzle_id, title, terminal_label, prompt, hint, login_name,
    password_hash, file_title, file_content, audio_files, is_active, is_note, updated_at
  ) values (
    sid, pid, ttl, terminal, pr, hi, uname,
    case when pw <> '' then crypt(pw, gen_salt('bf', 10)) else coalesce(old_hash, '') end,
    ft, fc, audio_list, active_flag, false, now()
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
    is_active = excluded.is_active,
    is_note = false,
    updated_at = now();
  return jsonb_build_object('saved', true, 'id', pid, 'updatedAt', clock_timestamp());
end
$function$;

create or replace function public.a_profecia_session_puzzle_delete(p_token text, p_session_id text, p_puzzle_id text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $function$
declare s public.a_profecia_sessions;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  delete from public.a_profecia_session_puzzles
   where session_id = left(trim(coalesce(p_session_id, '')), 180)
     and puzzle_id = left(trim(coalesce(p_puzzle_id, '')), 180) and not is_note;
  delete from public.a_profecia_session_puzzle_attempts
   where session_id = left(trim(coalesce(p_session_id, '')), 180)
     and puzzle_id = left(trim(coalesce(p_puzzle_id, '')), 180);
  return jsonb_build_object('deleted', true);
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
  return jsonb_build_object('ok', true, 'title', rec.file_title, 'content', rec.file_content, 'puzzleTitle', rec.title, 'audioFiles', rec.audio_files);
end
$function$;

create or replace function public.a_profecia_session_master_notes_get(p_token text, p_session_id text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  sid text := left(trim(coalesce(p_session_id, '')), 180);
  body text := '';
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  select file_content into body from public.a_profecia_session_puzzles
   where session_id = sid and puzzle_id = '__master_notes__' and is_note;
  return jsonb_build_object('sessionId', sid, 'notes', coalesce(body, ''));
end
$function$;

create or replace function public.a_profecia_session_master_notes_save(p_token text, p_session_id text, p_notes text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  sid text := left(trim(coalesce(p_session_id, '')), 180);
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if sid = '' then raise exception 'SESSAO_PUZZLE_INVALIDA'; end if;
  insert into public.a_profecia_session_puzzles(session_id,puzzle_id,title,terminal_label,prompt,hint,login_name,password_hash,file_title,file_content,is_active,is_note,updated_at)
  values(sid,'__master_notes__','Anotações privadas do Mestre','PRIVADO','Notas particulares da sessão','', '', '', 'Notas privadas', left(coalesce(p_notes,''),30000), false, true, now())
  on conflict(session_id,puzzle_id) do update set file_content=excluded.file_content,is_note=true,is_active=false,updated_at=now();
  return jsonb_build_object('saved',true,'updatedAt',clock_timestamp());
end
$function$;

revoke all on function public.a_profecia_session_puzzles_list(text,text) from public, authenticated;
revoke all on function public.a_profecia_session_puzzle_save(text,text,jsonb) from public, authenticated;
revoke all on function public.a_profecia_session_puzzle_delete(text,text,text) from public, authenticated;
revoke all on function public.a_profecia_session_puzzle_unlock(text,text,text,text,text) from public, authenticated;
revoke all on function public.a_profecia_session_master_notes_get(text,text) from public, authenticated;
revoke all on function public.a_profecia_session_master_notes_save(text,text,text) from public, authenticated;
grant execute on function public.a_profecia_session_puzzles_list(text,text) to anon;
grant execute on function public.a_profecia_session_puzzle_save(text,text,jsonb) to anon;
grant execute on function public.a_profecia_session_puzzle_delete(text,text,text) to anon;
grant execute on function public.a_profecia_session_puzzle_unlock(text,text,text,text,text) to anon;
grant execute on function public.a_profecia_session_master_notes_get(text,text) to anon;
grant execute on function public.a_profecia_session_master_notes_save(text,text,text) to anon;

-- Atualiza o cache de funções RPC do PostgREST assim que a migração for aplicada.
notify pgrst, 'reload schema';
