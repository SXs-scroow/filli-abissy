-- Player deletion integrity patch (2026-09-27)
-- Already applied to the production project during the stability patch.
-- Kept in the project so future database setup remains reproducible.

create or replace function public.a_profecia_player_delete(p_token text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  existing public.a_profecia_players;
  deleted_at_ts timestamptz;
  stamp bigint;
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if trim(coalesce(p_id,'')) = '' then raise exception 'PLAYER_ID_INVALIDO'; end if;
  select * into existing from public.a_profecia_players where id = trim(p_id) for update;
  if not found then return jsonb_build_object('id',trim(p_id),'found',false,'already_deleted',false); end if;
  if existing.deleted_at is not null then return jsonb_build_object('id',existing.id,'found',true,'already_deleted',true,'deleted_at',existing.deleted_at); end if;
  deleted_at_ts := clock_timestamp();
  stamp := (extract(epoch from deleted_at_ts) * 1000)::bigint;
  update public.a_profecia_players
     set data = jsonb_set(coalesce(existing.data,'{}'::jsonb), '{_syncUpdatedAt}', to_jsonb(stamp), true),
         updated_at = deleted_at_ts, deleted_at = deleted_at_ts
   where id = existing.id;
  delete from public.a_profecia_sessions where role = 'player' and player_id = existing.id;
  delete from public.a_profecia_player_secrets where player_id = existing.id;
  return jsonb_build_object('id',existing.id,'found',true,'already_deleted',false,'deleted_at',deleted_at_ts,'updated_at',deleted_at_ts,'sync_updated_at',stamp);
end
$function$;

revoke all on function public.a_profecia_player_delete(text,text) from public, authenticated;
grant execute on function public.a_profecia_player_delete(text,text) to anon;

create or replace function public.a_profecia_prevent_player_undelete()
returns trigger
language plpgsql
set search_path = public, extensions
as $function$
begin
  if old.deleted_at is not null and new.deleted_at is null then raise exception 'PLAYER_EXCLUIDO'; end if;
  return new;
end
$function$;

drop trigger if exists a_profecia_players_no_undelete on public.a_profecia_players;
create trigger a_profecia_players_no_undelete
before update on public.a_profecia_players
for each row execute function public.a_profecia_prevent_player_undelete();

revoke all on function public.a_profecia_prevent_player_undelete() from public, anon, authenticated;
