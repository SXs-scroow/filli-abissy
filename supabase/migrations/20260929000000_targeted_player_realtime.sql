-- V68: targeted player realtime reads.
-- Realtime already tells the browser which player changed. This RPC prevents
-- every event from reloading the entire player roster.
create or replace function public.a_profecia_get_players_by_ids(
  p_token text,
  p_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  s public.a_profecia_sessions;
  result jsonb;
begin
  s := public.a_profecia_auth(p_token);

  if p_ids is null or cardinality(p_ids) = 0 then
    return '[]'::jsonb;
  end if;

  if s.role = 'master' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'login', p.login,
        'data', (p.data - 'password' - 'newPassword'),
        'updated_at', p.updated_at,
        'deleted_at', p.deleted_at
      ) order by p.updated_at asc
    ), '[]'::jsonb)
    into result
    from public.a_profecia_players p
    where p.id = any(p_ids);
  elsif s.role = 'player' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'login', p.login,
        'data', case when p.deleted_at is null
          then (p.data - 'password' - 'newPassword')
          else jsonb_build_object('_syncUpdatedAt', p.data->'_syncUpdatedAt') end,
        'updated_at', p.updated_at,
        'deleted_at', p.deleted_at
      )
    ), '[]'::jsonb)
    into result
    from public.a_profecia_players p
    where p.id = s.player_id
      and p.id = any(p_ids);
  else
    raise exception 'NAO_AUTORIZADO';
  end if;

  return result;
end
$function$;

revoke all on function public.a_profecia_get_players_by_ids(text, text[]) from public;
grant execute on function public.a_profecia_get_players_by_ids(text, text[]) to anon, authenticated;
