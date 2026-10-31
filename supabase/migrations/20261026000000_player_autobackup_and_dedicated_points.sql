-- Player-level sheet backups + isolated persisted point allocation.
-- Additive only: the existing player JSON and player records are preserved.
create table if not exists public.a_profecia_player_history (
  id bigint generated always as identity primary key,
  player_id text not null,
  saved_by text,
  sync_stamp bigint,
  data jsonb not null,
  saved_at timestamptz not null default now()
);
alter table public.a_profecia_player_history enable row level security;
revoke all on table public.a_profecia_player_history from public, anon, authenticated;
create index if not exists a_profecia_player_history_player_saved_idx
  on public.a_profecia_player_history (player_id, saved_at desc, id desc);

create or replace function public.a_profecia_player_history_capture()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  last_row public.a_profecia_player_history;
  who text := nullif(current_setting('app.saved_by', true), '');
  newstamp bigint;
begin
  -- Keep a recoverable snapshot even when a row is hard-deleted.
  if tg_op = 'DELETE' then
    insert into public.a_profecia_player_history(player_id, saved_by, sync_stamp, data)
    values (
      old.id,
      coalesce(who, 'delete'),
      case when coalesce(old.data->>'_syncUpdatedAt','') ~ '^[0-9]{1,18}$'
        then (old.data->>'_syncUpdatedAt')::bigint else 0 end,
      old.data
    );
    return old;
  end if;

  newstamp := case
    when coalesce(new.data->>'_syncUpdatedAt','') ~ '^[0-9]{1,18}$'
      then (new.data->>'_syncUpdatedAt')::bigint
    else 0
  end;

  -- Keep a recoverable snapshot on soft deletion rather than erasing history.
  if new.deleted_at is not null then
    insert into public.a_profecia_player_history(player_id, saved_by, sync_stamp, data)
    values (new.id, coalesce(who, 'delete'), newstamp, new.data);
    return new;
  end if;

  select * into last_row
    from public.a_profecia_player_history
   where player_id = new.id
   order by saved_at desc, id desc
   limit 1;

  -- Ignore timestamp-only syncs; preserve content snapshots, not heartbeat noise.
  if found and (last_row.data - '_syncUpdatedAt') = (new.data - '_syncUpdatedAt') then
    return new;
  end if;

  -- Preserve each committed Player save. Keep 10-second coalescing for Master
  -- edits to avoid flooding history when the Master changes many fields quickly.
  if found and who is distinct from 'player'
     and last_row.saved_at > now() - interval '10 seconds'
     and last_row.saved_by is not distinct from who then
    update public.a_profecia_player_history
       set data = new.data, saved_at = now(), sync_stamp = newstamp
     where id = last_row.id;
    return new;
  end if;

  insert into public.a_profecia_player_history(player_id, saved_by, sync_stamp, data)
  values (new.id, who, newstamp, new.data);

  -- Retention: detailed first 24h, hourly samples up to 14d, then daily.
  delete from public.a_profecia_player_history h
   where h.player_id = new.id
     and h.saved_at < now() - interval '24 hours'
     and h.saved_at >= now() - interval '14 days'
     and h.id not in (
       select distinct on (date_trunc('hour', x.saved_at)) x.id
         from public.a_profecia_player_history x
        where x.player_id = new.id
          and x.saved_at < now() - interval '24 hours'
        order by date_trunc('hour', x.saved_at), x.saved_at desc, x.id desc
     );

  delete from public.a_profecia_player_history h
   where h.player_id = new.id
     and h.saved_at < now() - interval '14 days'
     and h.id not in (
       select distinct on (date_trunc('day', x.saved_at)) x.id
         from public.a_profecia_player_history x
        where x.player_id = new.id
          and x.saved_at < now() - interval '14 days'
        order by date_trunc('day', x.saved_at), x.saved_at desc, x.id desc
     );
  return new;
end
$function$;

revoke all on function public.a_profecia_player_history_capture() from public, anon, authenticated;
drop trigger if exists a_profecia_player_history_trg on public.a_profecia_players;
create trigger a_profecia_player_history_trg
  after insert or update or delete on public.a_profecia_players
  for each row execute function public.a_profecia_player_history_capture();

-- One dedicated record per Player keeps point allocations isolated without
-- creating a physical table per Player.
create table if not exists public.a_profecia_player_points (
  player_id text primary key,
  attrs jsonb not null default '{}'::jsonb,
  skills jsonb not null default '{}'::jsonb,
  points_stamp bigint not null default 0,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.a_profecia_player_points enable row level security;
revoke all on table public.a_profecia_player_points from public, anon, authenticated;
create index if not exists a_profecia_player_points_updated_idx
  on public.a_profecia_player_points (updated_at desc);

create or replace function public.a_profecia_player_points_sync()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  attrs_value jsonb;
  skills_value jsonb;
  stamp_value bigint;
begin
  if tg_op = 'DELETE' then
    -- The separate points record survives row deletion for recovery/audit.
    return old;
  end if;
  attrs_value := case when jsonb_typeof(new.data->'attrs') = 'object' then new.data->'attrs' else '{}'::jsonb end;
  skills_value := case when jsonb_typeof(new.data->'skills') = 'object' then new.data->'skills' else '{}'::jsonb end;
  stamp_value := case
    when coalesce(new.data->>'_pointsAt','') ~ '^[0-9]{1,18}$'
      then (new.data->>'_pointsAt')::bigint
    else 0
  end;

  insert into public.a_profecia_player_points(player_id, attrs, skills, points_stamp, updated_at)
  values (new.id, attrs_value, skills_value, stamp_value, clock_timestamp())
  on conflict (player_id) do update
    set attrs = excluded.attrs,
        skills = excluded.skills,
        points_stamp = excluded.points_stamp,
        updated_at = excluded.updated_at
  where public.a_profecia_player_points.attrs is distinct from excluded.attrs
     or public.a_profecia_player_points.skills is distinct from excluded.skills
     or public.a_profecia_player_points.points_stamp is distinct from excluded.points_stamp;
  return new;
end
$function$;

revoke all on function public.a_profecia_player_points_sync() from public, anon, authenticated;
drop trigger if exists a_profecia_player_points_sync_trg on public.a_profecia_players;
create trigger a_profecia_player_points_sync_trg
  after insert or update of data on public.a_profecia_players
  for each row execute function public.a_profecia_player_points_sync();

-- Backfill is non-destructive and copies only current point allocations.
insert into public.a_profecia_player_points(player_id, attrs, skills, points_stamp, updated_at)
select p.id,
       case when jsonb_typeof(p.data->'attrs') = 'object' then p.data->'attrs' else '{}'::jsonb end,
       case when jsonb_typeof(p.data->'skills') = 'object' then p.data->'skills' else '{}'::jsonb end,
       case when coalesce(p.data->>'_pointsAt','') ~ '^[0-9]{1,18}$' then (p.data->>'_pointsAt')::bigint else 0 end,
       coalesce(p.updated_at, now())
  from public.a_profecia_players p
on conflict (player_id) do update
  set attrs = excluded.attrs,
      skills = excluded.skills,
      points_stamp = excluded.points_stamp,
      updated_at = excluded.updated_at
where public.a_profecia_player_points.attrs is distinct from excluded.attrs
   or public.a_profecia_player_points.skills is distinct from excluded.skills
   or public.a_profecia_player_points.points_stamp is distinct from excluded.points_stamp;
