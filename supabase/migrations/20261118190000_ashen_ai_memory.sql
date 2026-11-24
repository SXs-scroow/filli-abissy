-- Memória persistente privada do Ashen AI. Os dados não entram no JSON global compartilhado.
create table if not exists public.a_profecia_ashen_memory (
  id text primary key,
  category text not null default 'fact'
    check (category in ('fact','event','character','location','clue','preference')),
  title text not null,
  content text not null,
  importance integer not null default 3 check (importance between 1 and 5),
  tags text[] not null default '{}',
  source_session_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (length(id) between 1 and 180),
  check (length(title) between 1 and 180),
  check (length(content) between 1 and 4000),
  check (cardinality(tags) <= 20)
);

alter table public.a_profecia_ashen_memory enable row level security;
revoke all on table public.a_profecia_ashen_memory from public, anon, authenticated;
create index if not exists a_profecia_ashen_memory_timeline_idx
  on public.a_profecia_ashen_memory (importance desc, updated_at desc)
  where archived_at is null;
create index if not exists a_profecia_ashen_memory_search_idx
  on public.a_profecia_ashen_memory using gin (
    to_tsvector('simple'::regconfig, coalesce(title,'') || ' ' || coalesce(content,'') || ' ' || array_to_string(tags,' '))
  ) where archived_at is null;

create or replace function public.a_profecia_ashen_memory_list(
  p_token text,
  p_search text default '',
  p_limit integer default 20
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s public.a_profecia_sessions;
  q text := left(trim(coalesce(p_search,'')), 180);
  lim integer := greatest(1, least(40, coalesce(p_limit,20)));
  result jsonb;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then
    raise exception 'NAO_AUTORIZADO';
  end if;

  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.importance desc, rows.updated_at desc), '[]'::jsonb)
    into result
    from (
      select m.*
        from public.a_profecia_ashen_memory m
       where m.archived_at is null
         and (q = '' or
              to_tsvector('simple'::regconfig, coalesce(m.title,'') || ' ' || coalesce(m.content,'') || ' ' || array_to_string(m.tags,' '))
                @@ plainto_tsquery('simple'::regconfig, q)
              or m.title ilike '%' || q || '%')
       order by m.importance desc, m.updated_at desc
       limit lim
    ) rows;
  return coalesce(result, '[]'::jsonb);
end
$function$;

create or replace function public.a_profecia_ashen_memory_save(
  p_token text,
  p_item jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s public.a_profecia_sessions;
  rid text := left(trim(coalesce(p_item->>'id','')),180);
  cat text := coalesce(nullif(trim(p_item->>'category'),''),'fact');
  ttl text := left(trim(coalesce(p_item->>'title','')),180);
  body text := left(trim(coalesce(p_item->>'content','')),4000);
  imp integer := greatest(1, least(5, coalesce(nullif(p_item->>'importance','')::integer,3)));
  tags text[] := '{}';
  saved public.a_profecia_ashen_memory%rowtype;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  if jsonb_typeof(p_item) is distinct from 'object' then raise exception 'MEMORIA_INVALIDA'; end if;
  if rid = '' then rid := pg_catalog.gen_random_uuid()::text; end if;
  if cat not in ('fact','event','character','location','clue','preference') then raise exception 'MEMORIA_CATEGORIA_INVALIDA'; end if;
  if ttl = '' or body = '' then raise exception 'MEMORIA_TITULO_E_CONTEUDO_OBRIGATORIOS'; end if;

  if jsonb_typeof(p_item->'tags') = 'array' then
    select coalesce(array_agg(tag), '{}') into tags
      from (
        select distinct left(trim(value),48) as tag
          from jsonb_array_elements_text(p_item->'tags') as x(value)
         where trim(value) <> '' limit 20
      ) cleaned;
  end if;

  insert into public.a_profecia_ashen_memory(id,category,title,content,importance,tags,source_session_id,created_at,updated_at,archived_at)
  values (rid,cat,ttl,body,imp,tags,left(coalesce(p_item->>'sourceSessionId',''),180),now(),now(),null)
  on conflict (id) do update
     set category=excluded.category, title=excluded.title, content=excluded.content,
         importance=excluded.importance, tags=excluded.tags,
         source_session_id=excluded.source_session_id,
         updated_at=now(), archived_at=null
  returning * into saved;
  return to_jsonb(saved);
end
$function$;

create or replace function public.a_profecia_ashen_memory_archive(
  p_token text,
  p_memory_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s public.a_profecia_sessions;
  saved public.a_profecia_ashen_memory%rowtype;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  update public.a_profecia_ashen_memory
     set archived_at=now(), updated_at=now()
   where id=left(trim(coalesce(p_memory_id,'')),180) and archived_at is null
   returning * into saved;
  if not found then return jsonb_build_object('archived',false,'missing',true); end if;
  return jsonb_build_object('archived',true,'id',saved.id,'title',saved.title);
end
$function$;

revoke all on function public.a_profecia_ashen_memory_list(text,text,integer) from public, authenticated;
revoke all on function public.a_profecia_ashen_memory_save(text,jsonb) from public, authenticated;
revoke all on function public.a_profecia_ashen_memory_archive(text,text) from public, authenticated;
grant execute on function public.a_profecia_ashen_memory_list(text,text,integer) to anon;
grant execute on function public.a_profecia_ashen_memory_save(text,jsonb) to anon;
grant execute on function public.a_profecia_ashen_memory_archive(text,text) to anon;
