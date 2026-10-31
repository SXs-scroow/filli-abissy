-- Ashen Testimony: idempotent repair of the Player Broadcast trigger.
-- Recreates only the trigger function and trigger; it does not update/delete any Player row.
-- Apply to staging first, verify Realtime end-to-end, then decide separately about production.

create or replace function public.a_profecia_player_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  perform realtime.send(
    jsonb_build_object('id', coalesce(new.id, old.id), 'op', lower(tg_op)),
    'player-changed',
    'a-profecia-players-events',
    false
  );
  return coalesce(new, old);
end
$function$;

revoke all on function public.a_profecia_player_broadcast() from public, anon, authenticated;

drop trigger if exists a_profecia_players_realtime on public.a_profecia_players;
create trigger a_profecia_players_realtime
after insert or update or delete on public.a_profecia_players
for each row execute function public.a_profecia_player_broadcast();
