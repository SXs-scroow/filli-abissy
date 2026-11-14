-- Ashen Testimony: Arquivo de Campanha privado e com histórico de alterações.
-- O conteúdo nunca é armazenado no JSON global compartilhado.

create table if not exists public.a_profecia_campaign_archive (
  id text primary key,
  kind text not null default 'event'
    check (kind in ('event','session','character','location','evidence','death','document')),
  title text not null,
  content text not null default '',
  occurred_at timestamptz not null default now(),
  location text not null default '',
  linked_player_id text not null default '',
  tags text[] not null default '{}',
  visibility text not null default 'master'
    check (visibility in ('master','public','group','player')),
  visible_player_ids text[] not null default '{}',
  revision integer not null default 1 check (revision > 0),
  created_by text not null default 'MESTRE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (length(id) between 1 and 180),
  check (length(title) between 1 and 180),
  check (length(content) <= 16000),
  check (length(location) <= 180),
  check (cardinality(tags) <= 20),
  check (
    (visibility in ('group','player') and cardinality(visible_player_ids) > 0)
    or (visibility in ('master','public') and cardinality(visible_player_ids) = 0)
  )
);

create index if not exists a_profecia_campaign_archive_timeline_idx
  on public.a_profecia_campaign_archive (occurred_at desc, updated_at desc)
  where deleted_at is null;
create index if not exists a_profecia_campaign_archive_visibility_idx
  on public.a_profecia_campaign_archive (visibility)
  where deleted_at is null;
create index if not exists a_profecia_campaign_archive_players_idx
  on public.a_profecia_campaign_archive using gin (visible_player_ids)
  where deleted_at is null;

create table if not exists public.a_profecia_campaign_archive_events (
  id bigint generated always as identity primary key,
  record_id text not null,
  action text not null check (action in ('created','updated','deleted','restored')),
  actor_id text not null default 'MESTRE',
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists a_profecia_campaign_archive_events_record_idx
  on public.a_profecia_campaign_archive_events (record_id, created_at desc);

alter table public.a_profecia_campaign_archive enable row level security;
alter table public.a_profecia_campaign_archive_events enable row level security;
revoke all on table public.a_profecia_campaign_archive from public, anon, authenticated;
revoke all on table public.a_profecia_campaign_archive_events from public, anon, authenticated;

create or replace function public.a_profecia_campaign_archive_list(
  p_token text,
  p_search text default '',
  p_kind text default 'all',
  p_include_archived boolean default false
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  q text := left(trim(coalesce(p_search,'')), 100);
  k text := coalesce(nullif(trim(p_kind),''), 'all');
  result jsonb;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' and s.role is distinct from 'player' then
    raise exception 'NAO_AUTORIZADO';
  end if;
  if k not in ('all','event','session','character','location','evidence','death','document') then
    k := 'all';
  end if;

  if s.role = 'master' then
    select coalesce(jsonb_agg(to_jsonb(rows) order by rows.occurred_at desc, rows.updated_at desc), '[]'::jsonb)
      into result
      from (select a.* from public.a_profecia_campaign_archive a
             where ((coalesce(p_include_archived,false) and a.deleted_at is not null) or (not coalesce(p_include_archived,false) and a.deleted_at is null))
               and (k = 'all' or a.kind = k)
               and (q = '' or a.title ilike '%' || q || '%' or a.content ilike '%' || q || '%' or a.location ilike '%' || q || '%' or array_to_string(a.tags, ' ') ilike '%' || q || '%')
             order by a.occurred_at desc, a.updated_at desc limit 500) rows;
    return coalesce(result, '[]'::jsonb);
  end if;

  if nullif(trim(coalesce(s.player_id,'')), '') is null then
    raise exception 'NAO_AUTORIZADO';
  end if;

  select coalesce(
    jsonb_agg((to_jsonb(rows) - 'visible_player_ids' - 'created_by') order by rows.occurred_at desc, rows.updated_at desc),
    '[]'::jsonb
  ) into result
  from (
    select a.* from public.a_profecia_campaign_archive a
    where a.deleted_at is null
      and (k = 'all' or a.kind = k)
      and (a.visibility = 'public' or (a.visibility in ('group','player') and s.player_id = any(a.visible_player_ids)))
      and (q = '' or a.title ilike '%' || q || '%' or a.content ilike '%' || q || '%' or a.location ilike '%' || q || '%' or array_to_string(a.tags, ' ') ilike '%' || q || '%')
    order by a.occurred_at desc, a.updated_at desc limit 500
  ) rows;
  return coalesce(result, '[]'::jsonb);
end
$function$;

create or replace function public.a_profecia_campaign_archive_save(
  p_token text,
  p_item jsonb,
  p_expected_revision integer default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  old_row public.a_profecia_campaign_archive%rowtype;
  saved_row public.a_profecia_campaign_archive%rowtype;
  rid text := left(trim(coalesce(p_item->>'id','')),180);
  k text := coalesce(nullif(trim(p_item->>'kind'),''),'event');
  ttl text := left(trim(coalesce(p_item->>'title','')),180);
  body text := left(coalesce(p_item->>'content',''),16000);
  loc text := left(trim(coalesce(p_item->>'location','')),180);
  linked text := left(trim(coalesce(p_item->>'linkedPlayerId','')),180);
  vis text := coalesce(nullif(trim(p_item->>'visibility'),''),'master');
  occurred timestamptz := coalesce(nullif(p_item->>'occurredAt','')::timestamptz, now());
  ids text[] := '{}';
  tag_list text[] := '{}';
  action_name text;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if jsonb_typeof(p_item) is distinct from 'object' then raise exception 'ARQUIVO_INVALIDO'; end if;
  if rid = '' then rid := gen_random_uuid()::text; end if;
  if k not in ('event','session','character','location','evidence','death','document') then raise exception 'ARQUIVO_TIPO_INVALIDO'; end if;
  if ttl = '' then raise exception 'ARQUIVO_TITULO_OBRIGATORIO'; end if;
  if vis not in ('master','public','group','player') then raise exception 'ARQUIVO_VISIBILIDADE_INVALIDA'; end if;

  if jsonb_typeof(p_item->'visiblePlayerIds') = 'array' then
    select coalesce(array_agg(distinct left(trim(value),180)), '{}') into ids
      from jsonb_array_elements_text(p_item->'visiblePlayerIds') as x(value)
     where trim(value) <> '';
  end if;
  if jsonb_typeof(p_item->'tags') = 'array' then
    select coalesce(array_agg(tag), '{}') into tag_list
      from (
        select distinct left(trim(value),48) as tag
          from jsonb_array_elements_text(p_item->'tags') as x(value)
         where trim(value) <> ''
         limit 20
      ) cleaned;
  else
    select coalesce(array_agg(tag), '{}') into tag_list
      from (select distinct left(trim(value),48) as tag
              from unnest(string_to_array(coalesce(p_item->>'tags',''), ',')) as x(value)
             where trim(value) <> '' limit 20) cleaned;
  end if;

  if vis = 'master' or vis = 'public' then
    ids := '{}';
  elsif vis = 'player' and cardinality(ids) <> 1 then
    raise exception 'ARQUIVO_SELECIONE_UM_PLAYER';
  elsif vis = 'group' and cardinality(ids) < 2 then
    raise exception 'ARQUIVO_SELECIONE_GRUPO';
  end if;

  if cardinality(ids) > 0 and cardinality(ids) <> (
    select count(*)::integer from public.a_profecia_players p
    where p.id = any(ids) and p.deleted_at is null
  ) then
    raise exception 'ARQUIVO_PLAYER_INVALIDO';
  end if;
  if linked <> '' and not exists (
    select 1 from public.a_profecia_players p where p.id = linked and p.deleted_at is null
  ) then
    raise exception 'ARQUIVO_PLAYER_INVALIDO';
  end if;

  select * into old_row
    from public.a_profecia_campaign_archive
   where id = rid and deleted_at is null
   for update;

  if found then
    if p_expected_revision is null or old_row.revision <> p_expected_revision then
      raise exception 'ARQUIVO_CONFLITO';
    end if;
    update public.a_profecia_campaign_archive
       set kind = k, title = ttl, content = body, occurred_at = occurred,
           location = loc, linked_player_id = linked, tags = tag_list,
           visibility = vis, visible_player_ids = ids,
           revision = old_row.revision + 1, updated_at = now()
     where id = rid
     returning * into saved_row;
    action_name := 'updated';
  else
    if coalesce(p_expected_revision,0) <> 0 then raise exception 'ARQUIVO_CONFLITO'; end if;
    insert into public.a_profecia_campaign_archive (
      id,kind,title,content,occurred_at,location,linked_player_id,tags,
      visibility,visible_player_ids,revision,created_by,created_at,updated_at
    ) values (
      rid,k,ttl,body,occurred,loc,linked,tag_list,vis,ids,1,
      coalesce(nullif(s.player_id,''),'MESTRE'),now(),now()
    ) returning * into saved_row;
    action_name := 'created';
  end if;

  insert into public.a_profecia_campaign_archive_events(record_id,action,actor_id,before_data,after_data)
  values (rid,action_name,'MESTRE',case when action_name='created' then null else to_jsonb(old_row) end,to_jsonb(saved_row));
  return to_jsonb(saved_row);
end
$function$;

create or replace function public.a_profecia_campaign_archive_delete(
  p_token text,
  p_record_id text,
  p_expected_revision integer
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  old_row public.a_profecia_campaign_archive%rowtype;
  saved_row public.a_profecia_campaign_archive%rowtype;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  select * into old_row from public.a_profecia_campaign_archive
   where id = left(trim(coalesce(p_record_id,'')),180) and deleted_at is null for update;
  if not found then return jsonb_build_object('deleted',false,'missing',true); end if;
  if old_row.revision <> p_expected_revision then raise exception 'ARQUIVO_CONFLITO'; end if;
  update public.a_profecia_campaign_archive
     set deleted_at=now(), updated_at=now(), revision=revision+1
   where id=old_row.id returning * into saved_row;
  insert into public.a_profecia_campaign_archive_events(record_id,action,actor_id,before_data,after_data)
  values(old_row.id,'deleted','MESTRE',to_jsonb(old_row),to_jsonb(saved_row));
  return jsonb_build_object('deleted',true,'revision',saved_row.revision);
end
$function$;

create or replace function public.a_profecia_campaign_archive_restore(
  p_token text,
  p_record_id text,
  p_expected_revision integer
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  old_row public.a_profecia_campaign_archive%rowtype;
  saved_row public.a_profecia_campaign_archive%rowtype;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  select * into old_row from public.a_profecia_campaign_archive
   where id = left(trim(coalesce(p_record_id,'')),180) and deleted_at is not null for update;
  if not found then return jsonb_build_object('restored',false,'missing',true); end if;
  if old_row.revision <> p_expected_revision then raise exception 'ARQUIVO_CONFLITO'; end if;
  update public.a_profecia_campaign_archive
     set deleted_at=null, updated_at=now(), revision=revision+1
   where id=old_row.id returning * into saved_row;
  insert into public.a_profecia_campaign_archive_events(record_id,action,actor_id,before_data,after_data)
  values(old_row.id,'restored','MESTRE',to_jsonb(old_row),to_jsonb(saved_row));
  return to_jsonb(saved_row);
end
$function$;

create or replace function public.a_profecia_campaign_archive_history(
  p_token text,
  p_record_id text
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  result jsonb;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
    into result
    from public.a_profecia_campaign_archive_events e
   where e.record_id = left(trim(coalesce(p_record_id,'')),180);
  return coalesce(result,'[]'::jsonb);
end
$function$;

revoke all on function public.a_profecia_campaign_archive_list(text,text,text,boolean) from public, authenticated;
revoke all on function public.a_profecia_campaign_archive_save(text,jsonb,integer) from public, authenticated;
revoke all on function public.a_profecia_campaign_archive_delete(text,text,integer) from public, authenticated;
revoke all on function public.a_profecia_campaign_archive_history(text,text) from public, authenticated;
revoke all on function public.a_profecia_campaign_archive_restore(text,text,integer) from public, authenticated;
grant execute on function public.a_profecia_campaign_archive_list(text,text,text,boolean) to anon;
grant execute on function public.a_profecia_campaign_archive_save(text,jsonb,integer) to anon;
grant execute on function public.a_profecia_campaign_archive_delete(text,text,integer) to anon;
grant execute on function public.a_profecia_campaign_archive_history(text,text) to anon;
grant execute on function public.a_profecia_campaign_archive_restore(text,text,integer) to anon;


create or replace function public.a_profecia_campaign_archive_broadcast()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $function$
begin
  perform realtime.send(jsonb_build_object('changed', true, 'at', extract(epoch from clock_timestamp())::bigint), 'campaign-archive-changed', 'a-profecia-live-v2', false);
  return new;
end
$function$;

revoke all on function public.a_profecia_campaign_archive_broadcast() from public, anon, authenticated;
drop trigger if exists a_profecia_campaign_archive_realtime on public.a_profecia_campaign_archive;
create trigger a_profecia_campaign_archive_realtime
after insert or update on public.a_profecia_campaign_archive
for each row execute function public.a_profecia_campaign_archive_broadcast();
