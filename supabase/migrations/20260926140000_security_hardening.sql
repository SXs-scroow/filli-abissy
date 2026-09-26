-- A Profecia security hardening (2026-09-26)
-- Remove direct public reads from the global state and expose only a role-aware RPC.
drop policy if exists "public read global" on public.a_profecia_global;

create or replace function public.a_profecia_get_global(p_token text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  d jsonb;
  s public.a_profecia_sessions;
begin
  select data into d from public.a_profecia_global where id = 'main';
  if d is null then return null; end if;

  -- The login page only needs branding/version before authentication.
  if nullif(trim(coalesce(p_token, '')), '') is null then
    return jsonb_build_object(
      'version', d->'version',
      'siteBrand', d->'siteBrand'
    );
  end if;

  begin
    s := public.a_profecia_auth(p_token);
  exception when others then
    -- Do not leak whether a token was valid. Return the same public bootstrap.
    return jsonb_build_object(
      'version', d->'version',
      'siteBrand', d->'siteBrand'
    );
  end;

  if s.role = 'master' then
    return d;
  end if;

  -- Players do not receive the roster/tombstones stored in the legacy global JSON.
  -- Their own character data is served through a_profecia_list_players, which
  -- already removes password fields and enforces the player_id from the session.
  return d - 'players' - 'playerTombstones';
end
$$;

revoke all on function public.a_profecia_get_global(text) from public, authenticated;
grant execute on function public.a_profecia_get_global(text) to anon;

create or replace function public.a_profecia_list_global_backups(p_token text, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.a_profecia_sessions;
  result jsonb;
  lim integer := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', g.id, 'data', g.data, 'updated_at', g.updated_at)
      order by g.updated_at desc
    ), '[]'::jsonb
  )
  into result
  from (
    select id, data, updated_at
    from public.a_profecia_global
    where id like 'backup-%'
    order by updated_at desc
    limit lim
  ) g;

  return result;
end
$$;

revoke all on function public.a_profecia_list_global_backups(text, integer) from public, authenticated;
grant execute on function public.a_profecia_list_global_backups(text, integer) to anon;

-- Files remain publicly readable because Players/TV need to play them, but uploads
-- and replacements are now performed only by the authenticated Edge Function.
drop policy if exists "public upload assets" on storage.objects;
drop policy if exists "public update assets" on storage.objects;
