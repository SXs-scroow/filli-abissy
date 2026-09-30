-- A Profecia: segredos exclusivos do Mestre para uma ficha de Player.
-- Nunca ficam no JSON da ficha entregue ao Player.
create table if not exists public.a_profecia_player_master_secrets (
  player_id text primary key references public.a_profecia_players(id) on delete cascade,
  secret_loved_effect text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.a_profecia_player_master_secrets enable row level security;
revoke all on table public.a_profecia_player_master_secrets from public, anon, authenticated;

create or replace function public.a_profecia_player_master_secret_get(
  p_token text,
  p_player_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  pid text := trim(coalesce(p_player_id,''));
  v text := '';
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if pid = '' then raise exception 'PLAYER_ID_INVALIDO'; end if;
  select secret_loved_effect into v
    from public.a_profecia_player_master_secrets
   where player_id = pid;
  return jsonb_build_object('player_id',pid,'secret_loved_effect',coalesce(v,''));
end
$function$;

create or replace function public.a_profecia_player_master_secret_save(
  p_token text,
  p_player_id text,
  p_secret_loved_effect text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  pid text := trim(coalesce(p_player_id,''));
  value text := left(coalesce(p_secret_loved_effect,''),4000);
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if pid = '' then raise exception 'PLAYER_ID_INVALIDO'; end if;
  if not exists(select 1 from public.a_profecia_players where id=pid and deleted_at is null) then
    raise exception 'PLAYER_EXCLUIDO';
  end if;
  insert into public.a_profecia_player_master_secrets(player_id,secret_loved_effect,updated_at)
    values(pid,value,now())
    on conflict(player_id) do update set secret_loved_effect=excluded.secret_loved_effect,updated_at=now();
  return jsonb_build_object('player_id',pid,'saved',true,'updated_at',clock_timestamp());
end
$function$;

revoke all on function public.a_profecia_player_master_secret_get(text,text) from public, authenticated;
grant execute on function public.a_profecia_player_master_secret_get(text,text) to anon;
revoke all on function public.a_profecia_player_master_secret_save(text,text,text) from public, authenticated;
grant execute on function public.a_profecia_player_master_secret_save(text,text,text) to anon;
