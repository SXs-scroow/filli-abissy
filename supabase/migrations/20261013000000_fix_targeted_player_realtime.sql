-- Reinstala a RPC de leitura direcionada usada pelo Realtime.
-- Também preserva a confirmação explícita de exclusão para o token revogado
-- do próprio Player, sem restaurar a sessão nem permitir gravações.
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
  revoked_pid text;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return '[]'::jsonb;
  end if;

  begin
    s := public.a_profecia_auth(p_token);
  exception when others then
    if sqlerrm is distinct from 'SESSAO_INVALIDA' then raise; end if;
    select r.player_id into revoked_pid
      from public.a_profecia_revoked_player_sessions r
     where r.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
       and r.expires_at > now();
    if revoked_pid is null or not (revoked_pid = any(p_ids)) then
      raise exception 'SESSAO_INVALIDA';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'login', p.login,
      'data', jsonb_build_object('_syncUpdatedAt', p.data->'_syncUpdatedAt'),
      'updated_at', p.updated_at,
      'deleted_at', p.deleted_at
    )), '[]'::jsonb)
      into result
      from public.a_profecia_players p
     where p.id = revoked_pid and p.deleted_at is not null;
    return result;
  end;

  if s.role = 'master' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'login', p.login,
      'data', (p.data - 'password' - 'newPassword'),
      'updated_at', p.updated_at,
      'deleted_at', p.deleted_at
    ) order by p.updated_at asc), '[]'::jsonb)
      into result
      from public.a_profecia_players p
     where p.id = any(p_ids);
  elsif s.role = 'player' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'login', p.login,
      'data', case when p.deleted_at is null
        then (p.data - 'password' - 'newPassword')
        else jsonb_build_object('_syncUpdatedAt', p.data->'_syncUpdatedAt') end,
      'updated_at', p.updated_at,
      'deleted_at', p.deleted_at
    )), '[]'::jsonb)
      into result
      from public.a_profecia_players p
     where p.id = s.player_id and p.id = any(p_ids);
  else
    raise exception 'NAO_AUTORIZADO';
  end if;

  return result;
end
$function$;

revoke all on function public.a_profecia_get_players_by_ids(text, text[]) from public, authenticated;
grant execute on function public.a_profecia_get_players_by_ids(text, text[]) to anon;
