-- A Profecia: safe Player recovery.
-- Master-only restore from a tombstoned row. Never clears deleted_at for Players.
-- Instead, restore creates a fresh row with the same stable ID and sanitized data.
create or replace function public.a_profecia_player_restore(
  p_token text,
  p_id text,
  p_login text,
  p_data jsonb,
  p_sync_updated_at bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  existing public.a_profecia_players;
  clean_data jsonb := coalesce(p_data, '{}'::jsonb) - 'password' - 'newPassword' - 'secretLovedEffect';
  pid text := trim(coalesce(p_id,''));
  plogin text := trim(coalesce(p_login,''));
  stamp bigint := coalesce(p_sync_updated_at, (extract(epoch from clock_timestamp()) * 1000)::bigint);
  restored_at timestamptz := clock_timestamp();
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if pid = '' or plogin = '' then raise exception 'PLAYER_ID_INVALIDO'; end if;

  select * into existing from public.a_profecia_players where id = pid for update;
  if not found then raise exception 'PLAYER_NAO_ENCONTRADO'; end if;
  if existing.deleted_at is null then raise exception 'PLAYER_NAO_EXCLUIDO'; end if;

  clean_data := jsonb_set(clean_data, '{_syncUpdatedAt}', to_jsonb(stamp), true);

  -- The normal Player table deliberately forbids clearing deleted_at on UPDATE.
  -- Recovery therefore replaces the tombstoned row inside this single transaction.
  delete from public.a_profecia_players where id = pid;
  insert into public.a_profecia_players(id, login, data, updated_at, deleted_at)
    values (pid, plogin, clean_data, restored_at, null);

  return jsonb_build_object(
    'id', pid,
    'login', plogin,
    'restored_at', restored_at,
    'sync_updated_at', stamp
  );
end
$function$;

revoke all on function public.a_profecia_player_restore(text,text,text,jsonb,bigint) from public, authenticated;
grant execute on function public.a_profecia_player_restore(text,text,text,jsonb,bigint) to anon;
