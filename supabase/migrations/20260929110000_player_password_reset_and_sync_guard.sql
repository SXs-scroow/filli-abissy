-- A Profecia: deterministic Player password reset + sync safety.
-- Password changes are intentionally separate from normal ficha synchronization.

create or replace function public.a_profecia_player_set_password(
  p_token text,
  p_player_id text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  existing public.a_profecia_players;
  pid text := trim(coalesce(p_player_id,''));
  pw text := coalesce(p_new_password,'');
  stamp bigint;
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if pid = '' then raise exception 'PLAYER_ID_INVALIDO'; end if;
  if length(pw) < 4 or length(pw) > 72 then raise exception 'SENHA_INVALIDA'; end if;

  select * into existing
  from public.a_profecia_players
  where id = pid
  for update;
  if not found then raise exception 'PLAYER_ID_INVALIDO'; end if;
  if existing.deleted_at is not null then raise exception 'PLAYER_EXCLUIDO'; end if;

  insert into public.a_profecia_player_secrets(player_id, password_hash)
    values (pid, crypt(pw, gen_salt('bf', 10)))
    on conflict (player_id) do update
      set password_hash = excluded.password_hash,
          updated_at = now();

  -- A reset invalidates existing Player sessions so the new credential is the
  -- single path back into the ficha.
  delete from public.a_profecia_sessions
   where role = 'player' and player_id = pid;

  stamp := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  return jsonb_build_object(
    'id', existing.id,
    'login', existing.login,
    'updated_at', clock_timestamp(),
    'sync_updated_at', stamp
  );
end
$function$;

revoke all on function public.a_profecia_player_set_password(text,text,text) from public, authenticated;
grant execute on function public.a_profecia_player_set_password(text,text,text) to anon;
