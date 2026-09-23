create or replace function public.a_profecia_list_players(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.a_profecia_sessions;
  result jsonb;
begin
  s := public.a_profecia_auth(p_token);

  if s.role = 'master' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'login', p.login,
          'data', (p.data - 'password' - 'newPassword'),
          'updated_at', p.updated_at,
          'deleted_at', p.deleted_at
        ) order by p.updated_at asc
      ), '[]'::jsonb
    ) into result
    from public.a_profecia_players p;
  else
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'login', p.login,
          'data', (p.data - 'password' - 'newPassword'),
          'updated_at', p.updated_at,
          'deleted_at', p.deleted_at
        )
      ), '[]'::jsonb
    ) into result
    from public.a_profecia_players p
    where p.id = s.player_id and p.deleted_at is null;
  end if;

  return result;
end
$$;

revoke all on function public.a_profecia_list_players(text) from public, authenticated;
grant execute on function public.a_profecia_list_players(text) to anon;

revoke execute on function public.a_profecia_backup_global(text,jsonb,text) from public, authenticated;
grant execute on function public.a_profecia_backup_global(text,jsonb,text) to anon;
revoke execute on function public.a_profecia_change_master_password(text,text,text) from public, authenticated;
grant execute on function public.a_profecia_change_master_password(text,text,text) to anon;
revoke execute on function public.a_profecia_logout(text) from public, authenticated;
grant execute on function public.a_profecia_logout(text) to anon;
revoke execute on function public.a_profecia_master_login(text) from public, authenticated;
grant execute on function public.a_profecia_master_login(text) to anon;
revoke execute on function public.a_profecia_player_login(text,text) from public, authenticated;
grant execute on function public.a_profecia_player_login(text,text) to anon;
revoke execute on function public.a_profecia_player_save(text,text,text,jsonb,bigint,timestamptz) from public, authenticated;
grant execute on function public.a_profecia_player_save(text,text,text,jsonb,bigint,timestamptz) to anon;
revoke execute on function public.a_profecia_push_global(text,jsonb) from public, authenticated;
grant execute on function public.a_profecia_push_global(text,jsonb) to anon;
revoke execute on function public.a_profecia_register_player(text,text,jsonb) from public, authenticated;
grant execute on function public.a_profecia_register_player(text,text,jsonb) to anon;
revoke execute on function public.a_profecia_whoami(text) from public, authenticated;
grant execute on function public.a_profecia_whoami(text) to anon;

drop policy if exists "public read players" on public.a_profecia_players;

create or replace function public.a_profecia_player_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', coalesce(new.id, old.id), 'op', lower(tg_op)),
    'player-changed',
    'a-profecia-players-events',
    false
  );
  return coalesce(new, old);
end
$$;

drop trigger if exists a_profecia_players_realtime on public.a_profecia_players;
create trigger a_profecia_players_realtime
after insert or update or delete on public.a_profecia_players
for each row execute function public.a_profecia_player_broadcast();

revoke all on function public.a_profecia_player_broadcast() from public, anon, authenticated;
