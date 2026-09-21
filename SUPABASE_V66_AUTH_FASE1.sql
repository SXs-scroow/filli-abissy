-- A PROFECIA V66 — AUTENTICAÇÃO NO SERVIDOR (FASE 1: só adiciona; não quebra o site atual)
-- Cria tabelas privadas (senhas com hash bcrypt, sessões) e funções RPC. Nada é bloqueado ainda.
-- A FASE 2 (SUPABASE_V66_AUTH_FASE2.sql) fecha a escrita pública depois que o site novo estiver publicado.

create extension if not exists pgcrypto with schema extensions;

-- ---------- tabelas privadas (sem policy = invisíveis para a chave pública) ----------
create table if not exists public.a_profecia_secrets (
  k text primary key, v text not null, updated_at timestamptz not null default now());
create table if not exists public.a_profecia_player_secrets (
  player_id text primary key, password_hash text not null, updated_at timestamptz not null default now());
create table if not exists public.a_profecia_sessions (
  token_hash text primary key,
  role text not null check (role in ('master','player')),
  player_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null);
create table if not exists public.a_profecia_rate_limits (
  bucket text primary key, n int not null default 0, window_start timestamptz not null default now());

alter table public.a_profecia_secrets enable row level security;
alter table public.a_profecia_player_secrets enable row level security;
alter table public.a_profecia_sessions enable row level security;
alter table public.a_profecia_rate_limits enable row level security;
revoke all on public.a_profecia_secrets, public.a_profecia_player_secrets,
              public.a_profecia_sessions, public.a_profecia_rate_limits from public, anon, authenticated;

-- ---------- funções internas (ninguém de fora chama) ----------
create or replace function public.a_profecia_rate_check(p_bucket text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
declare r public.a_profecia_rate_limits;
begin
  select * into r from public.a_profecia_rate_limits where bucket = p_bucket;
  if found and r.window_start >= now() - p_window and r.n >= p_max then
    raise exception 'MUITAS_TENTATIVAS';
  end if;
end $$;

create or replace function public.a_profecia_rate_hit(p_bucket text, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.a_profecia_rate_limits(bucket, n, window_start) values (p_bucket, 1, now())
  on conflict (bucket) do update set
    n = case when public.a_profecia_rate_limits.window_start < now() - p_window then 1 else public.a_profecia_rate_limits.n + 1 end,
    window_start = case when public.a_profecia_rate_limits.window_start < now() - p_window then now() else public.a_profecia_rate_limits.window_start end;
end $$;

create or replace function public.a_profecia_auth(p_token text)
returns public.a_profecia_sessions language plpgsql security definer set search_path = public, extensions as $$
declare s public.a_profecia_sessions;
begin
  select * into s from public.a_profecia_sessions
   where token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex') and expires_at > now();
  if not found then raise exception 'SESSAO_INVALIDA'; end if;
  return s;
end $$;

create or replace function public.a_profecia_new_session(p_role text, p_player_id text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(32), 'hex');
begin
  delete from public.a_profecia_sessions where expires_at < now();
  insert into public.a_profecia_sessions(token_hash, role, player_id, expires_at)
  values (encode(digest(t, 'sha256'), 'hex'), p_role, p_player_id, now() + interval '30 days');
  return t;
end $$;

-- ---------- login do Mestre ----------
create or replace function public.a_profecia_master_login(p_password text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  perform public.a_profecia_rate_check('master', 15, interval '10 minutes');
  select v into h from public.a_profecia_secrets where k = 'master_password_hash';
  if h is null or crypt(coalesce(p_password,''), h) <> h then
    perform public.a_profecia_rate_hit('master', interval '10 minutes');
    return null;
  end if;
  delete from public.a_profecia_rate_limits where bucket = 'master';
  return public.a_profecia_new_session('master', null);
end $$;

-- ---------- login de Player ----------
create or replace function public.a_profecia_player_login(p_login text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.a_profecia_players; h text; ok boolean := false; t text;
  b text := 'pl:' || lower(trim(coalesce(p_login,'')));
begin
  perform public.a_profecia_rate_check(b, 10, interval '10 minutes');
  select * into r from public.a_profecia_players
   where lower(login) = lower(trim(coalesce(p_login,''))) and deleted_at is null;
  if found and coalesce(p_password,'') <> '' then
    select password_hash into h from public.a_profecia_player_secrets where player_id = r.id;
    if h is not null and crypt(p_password, h) = h then
      ok := true;
    elsif coalesce(r.data->>'password','') <> '' and r.data->>'password' = p_password then
      -- transição: senha ainda em texto puro (gravada por versão antiga do site). Converte para hash.
      ok := true;
      insert into public.a_profecia_player_secrets(player_id, password_hash)
        values (r.id, crypt(p_password, gen_salt('bf', 10)))
      on conflict (player_id) do update set password_hash = excluded.password_hash, updated_at = now();
    end if;
  end if;
  if not ok then
    perform public.a_profecia_rate_hit(b, interval '10 minutes');
    return null;
  end if;
  delete from public.a_profecia_rate_limits where bucket = b;
  t := public.a_profecia_new_session('player', r.id);
  return jsonb_build_object('token', t, 'id', r.id, 'player', (r.data - 'password' - 'newPassword'));
end $$;

-- ---------- cadastro de Player ----------
create or replace function public.a_profecia_register_player(p_login text, p_password text, p_player jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  lg text := trim(coalesce(p_login,'')); pid text; d jsonb; stamp bigint := (extract(epoch from now()) * 1000)::bigint; t text;
  master_login text;
begin
  if length(lg) < 3 or length(lg) > 32 then raise exception 'LOGIN_INVALIDO'; end if;
  if length(coalesce(p_password,'')) < 4 or length(p_password) > 72 then raise exception 'SENHA_INVALIDA'; end if;
  select v into master_login from public.a_profecia_secrets where k = 'master_login';
  if master_login is not null and lower(lg) = lower(master_login) then raise exception 'LOGIN_RESERVADO'; end if;
  perform public.a_profecia_rate_check('register', 20, interval '1 hour');
  if exists (select 1 from public.a_profecia_players where lower(login) = lower(lg)) then raise exception 'LOGIN_EXISTE'; end if;
  pid := coalesce(nullif(trim(p_player->>'id'), ''), 'p-' || stamp || '-' || substr(md5(random()::text), 1, 5));
  if exists (select 1 from public.a_profecia_players where id = pid) then raise exception 'ID_EXISTE'; end if;
  d := (coalesce(p_player, '{}'::jsonb) - 'password' - 'newPassword')
       || jsonb_build_object('id', pid, 'login', lg, '_syncUpdatedAt', stamp);
  if octet_length(d::text) > 2000000 then raise exception 'DADOS_GRANDES'; end if;
  perform public.a_profecia_rate_hit('register', interval '1 hour');
  insert into public.a_profecia_players(id, login, data, updated_at, deleted_at)
    values (pid, lg, d, to_timestamp(stamp / 1000.0), null);
  insert into public.a_profecia_player_secrets(player_id, password_hash)
    values (pid, crypt(p_password, gen_salt('bf', 10)));
  t := public.a_profecia_new_session('player', pid);
  return jsonb_build_object('token', t, 'id', pid, 'player', d);
end $$;

-- ---------- salvar ficha (Mestre: qualquer uma; Player: só a própria) ----------
create or replace function public.a_profecia_player_save(
  p_token text, p_id text, p_login text, p_data jsonb, p_sync_updated_at bigint, p_deleted_at timestamptz default null)
returns public.a_profecia_players language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.a_profecia_sessions; existing public.a_profecia_players; result_row public.a_profecia_players;
  pid text := trim(coalesce(p_id,'')); lg text := trim(coalesce(p_login,''));
  stamp bigint := coalesce(p_sync_updated_at, (extract(epoch from now()) * 1000)::bigint);
  d jsonb; newpw text; legacypw text; k text; had boolean;
begin
  s := public.a_profecia_auth(p_token);
  if pid = '' or lg = '' then raise exception 'Player sem id ou login'; end if;
  if s.role = 'player' and (s.player_id is distinct from pid or p_deleted_at is not null) then
    raise exception 'NAO_AUTORIZADO';
  end if;
  if octet_length(coalesce(p_data,'{}'::jsonb)::text) > 2000000 then raise exception 'DADOS_GRANDES'; end if;

  select * into existing from public.a_profecia_players where id = pid for update;
  had := found;
  newpw := nullif(p_data->>'newPassword', '');
  legacypw := nullif(p_data->>'password', '');
  d := coalesce(p_data, '{}'::jsonb) - 'password' - 'newPassword';

  if s.role = 'player' and had then
    lg := existing.login;                       -- Player não troca o próprio login
    foreach k in array array['masterNotes','attrBonusPoints','skillBonusPoints'] loop
      if existing.data ? k then d := jsonb_set(d, array[k], existing.data->k, true); else d := d - k; end if;
    end loop;
  end if;

  -- senha: só o Mestre define (newPassword). "password" legado só serve se ainda não existe hash.
  if s.role = 'master' and newpw is not null then
    if length(newpw) < 4 or length(newpw) > 72 then raise exception 'SENHA_INVALIDA'; end if;
    insert into public.a_profecia_player_secrets(player_id, password_hash) values (pid, crypt(newpw, gen_salt('bf', 10)))
    on conflict (player_id) do update set password_hash = excluded.password_hash, updated_at = now();
    delete from public.a_profecia_sessions where role = 'player' and player_id = pid;
  elsif legacypw is not null and not exists (select 1 from public.a_profecia_player_secrets where player_id = pid) then
    insert into public.a_profecia_player_secrets(player_id, password_hash) values (pid, crypt(legacypw, gen_salt('bf', 10)))
    on conflict (player_id) do nothing;
  end if;

  if had then
    if coalesce((existing.data->>'_syncUpdatedAt')::bigint, (extract(epoch from existing.updated_at) * 1000)::bigint, 0) > stamp then
      return existing;
    end if;
  end if;
  d := jsonb_set(d, '{_syncUpdatedAt}', to_jsonb(stamp), true);

  insert into public.a_profecia_players(id, login, data, updated_at, deleted_at)
  values (pid, lg, d, to_timestamp(stamp / 1000.0), p_deleted_at)
  on conflict (id) do update
    set login = excluded.login, data = excluded.data, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
    where coalesce((public.a_profecia_players.data->>'_syncUpdatedAt')::bigint, (extract(epoch from public.a_profecia_players.updated_at) * 1000)::bigint, 0) <= stamp;

  if p_deleted_at is not null then
    delete from public.a_profecia_sessions where role = 'player' and player_id = pid;
    delete from public.a_profecia_player_secrets where player_id = pid;
  end if;

  select * into result_row from public.a_profecia_players where id = pid;
  return result_row;
end $$;

-- ---------- estado global (só Mestre) ----------
create or replace function public.a_profecia_push_global(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s public.a_profecia_sessions; u timestamptz;
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'DADOS_INVALIDOS'; end if;
  if octet_length(p_data::text) > 30000000 then raise exception 'DADOS_GRANDES'; end if;
  insert into public.a_profecia_global(id, data, updated_at) values ('main', p_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = now()
  returning updated_at into u;
  return jsonb_build_object('updated_at', u);
end $$;

create or replace function public.a_profecia_backup_global(p_token text, p_data jsonb, p_label text default 'auto')
returns text language plpgsql security definer set search_path = public, extensions as $$
declare s public.a_profecia_sessions; bid text;
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'DADOS_INVALIDOS'; end if;
  bid := 'backup-' || (extract(epoch from now()) * 1000)::bigint || '-' || substr(md5(random()::text), 1, 6);
  insert into public.a_profecia_global(id, data, updated_at)
  values (bid, p_data || jsonb_build_object('__backup', jsonb_build_object('label', left(coalesce(p_label,'auto'), 80), 'createdAt', now())), now());
  -- mantém os 150 backups mais recentes
  delete from public.a_profecia_global where id in (
    select id from public.a_profecia_global where id like 'backup-%' order by updated_at desc offset 150);
  return bid;
end $$;

-- ---------- sessão / senha do Mestre ----------
create or replace function public.a_profecia_whoami(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s public.a_profecia_sessions;
begin
  select * into s from public.a_profecia_sessions
   where token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex') and expires_at > now();
  if not found then return null; end if;
  return jsonb_build_object('role', s.role, 'player_id', s.player_id);
end $$;

create or replace function public.a_profecia_logout(p_token text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.a_profecia_sessions where token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex');
end $$;

create or replace function public.a_profecia_change_master_password(p_token text, p_old text, p_new text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare s public.a_profecia_sessions; h text;
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  perform public.a_profecia_rate_check('master-change', 10, interval '10 minutes');
  select v into h from public.a_profecia_secrets where k = 'master_password_hash';
  if h is null or crypt(coalesce(p_old,''), h) <> h then
    perform public.a_profecia_rate_hit('master-change', interval '10 minutes');
    return false;
  end if;
  if length(coalesce(p_new,'')) < 10 or length(p_new) > 72 then raise exception 'SENHA_FRACA'; end if;
  update public.a_profecia_secrets set v = crypt(p_new, gen_salt('bf', 12)), updated_at = now() where k = 'master_password_hash';
  delete from public.a_profecia_sessions
   where role = 'master' and token_hash <> encode(digest(p_token, 'sha256'), 'hex');
  return true;
end $$;

-- ---------- permissões: internas fechadas; públicas só as que o site chama ----------
revoke execute on function
  public.a_profecia_rate_check(text,int,interval), public.a_profecia_rate_hit(text,interval),
  public.a_profecia_auth(text), public.a_profecia_new_session(text,text)
  from public, anon, authenticated;
revoke execute on function
  public.a_profecia_master_login(text), public.a_profecia_player_login(text,text),
  public.a_profecia_register_player(text,text,jsonb),
  public.a_profecia_player_save(text,text,text,jsonb,bigint,timestamptz),
  public.a_profecia_push_global(text,jsonb), public.a_profecia_backup_global(text,jsonb,text),
  public.a_profecia_whoami(text), public.a_profecia_logout(text),
  public.a_profecia_change_master_password(text,text,text)
  from public;
grant execute on function
  public.a_profecia_master_login(text), public.a_profecia_player_login(text,text),
  public.a_profecia_register_player(text,text,jsonb),
  public.a_profecia_player_save(text,text,text,jsonb,bigint,timestamptz),
  public.a_profecia_push_global(text,jsonb), public.a_profecia_backup_global(text,jsonb,text),
  public.a_profecia_whoami(text), public.a_profecia_logout(text),
  public.a_profecia_change_master_password(text,text,text)
  to anon, authenticated;

-- ---------- sementes ----------
insert into public.a_profecia_secrets(k, v) values ('master_login', 'SXscroow') on conflict (k) do nothing;
-- Senha inicial do Mestre = a atual do site (para nada mudar agora). TROQUE pelo botão "Trocar senha do Mestre".
insert into public.a_profecia_secrets(k, v) values ('master_password_hash', extensions.crypt('Amarantos1805', extensions.gen_salt('bf', 12)))
on conflict (k) do nothing;

-- Converte as senhas atuais dos Players (texto puro) em hash. O texto puro só será apagado na Fase 2.
insert into public.a_profecia_player_secrets(player_id, password_hash)
select id, extensions.crypt(data->>'password', extensions.gen_salt('bf', 10))
from public.a_profecia_players
where coalesce(data->>'password','') <> '' and deleted_at is null
on conflict (player_id) do nothing;
