-- Ashen Testimony V1.4.7
-- (1) Proteção por CAMPO: cada campo da ficha tem carimbo próprio (_keyAt); cópia antiga não apaga campo mais novo.
-- (2) Histórico no servidor (tabela separada, só o Mestre lê), guardado até o Player ser excluído.

-- ===== (1) a_profecia_player_save: acrescenta merge por campo, sem reescrever a função inteira =====
do $patch$
declare
  def text;
  a1 text := E'  inc_pts bigint := 0;\n';
  a2 text := E'  if s.role = ''master'' and newpw is not null then\n';
  a3 text := E'    if coalesce((existing.data->>''_syncUpdatedAt'')::bigint,\n                (extract(epoch from existing.updated_at) * 1000)::bigint, 0) > stamp then\n';
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'a_profecia_player_save';
  if def is null then raise exception 'a_profecia_player_save não encontrada'; end if;
  if def like '%_keyAt%' then return; end if;   -- já aplicado
  if position(a1 in def) = 0 or position(a2 in def) = 0 or position(a3 in def) = 0 then
    raise exception 'ancoras do patch não encontradas';
  end if;

  def := replace(def, a1, a1 || $r$  skip_keys text[] := array['_syncUpdatedAt','_pointsAt','_keyAt','attrs','skills','rolls','secretClues','password','newPassword','secretLovedEffect','id','login'];
  ex_keys jsonb := '{}'::jsonb;
  in_keys jsonb := '{}'::jsonb;
  merged jsonb;
  mk jsonb;
  changed boolean := false;
  sk text;
  sv bigint;
  ev bigint;
  exst bigint;
$r$);

  def := replace(def, a2, $r$  perform set_config('app.saved_by', coalesce(s.role, ''), true);
  if jsonb_typeof(d->'_keyAt') = 'object' then in_keys := d->'_keyAt'; end if;
  if had then
    if jsonb_typeof(existing.data->'_keyAt') = 'object' then ex_keys := existing.data->'_keyAt'; end if;
    -- Campo que já está salvo com carimbo MAIS NOVO que o recebido: mantém o salvo.
    for sk in select jsonb_object_keys(existing.data) loop
      continue when sk = any(skip_keys);
      ev := case when (ex_keys->>sk) ~ '^[0-9]{1,18}$' then (ex_keys->>sk)::bigint else 0 end;
      continue when ev = 0;
      sv := case when (in_keys->>sk) ~ '^[0-9]{1,18}$' then (in_keys->>sk)::bigint else 0 end;
      if sv < ev then
        d := jsonb_set(d, array[sk], existing.data->sk, true);
        in_keys := jsonb_set(in_keys, array[sk], to_jsonb(ev), true);
      end if;
    end loop;
  end if;
  d := jsonb_set(d, '{_keyAt}', in_keys, true);

$r$ || a2);

  def := replace(def, a3, a3 || $r$      -- Gravação com carimbo geral antigo: ainda assim aproveita os campos (e pontos) MAIS NOVOS.
      exst := coalesce((existing.data->>'_syncUpdatedAt')::bigint, (extract(epoch from existing.updated_at) * 1000)::bigint, 0);
      merged := existing.data;
      mk := ex_keys;
      changed := false;
      if inc_pts > ex_pts and jsonb_typeof(d->'attrs') = 'object' and jsonb_typeof(d->'skills') = 'object' then
        merged := jsonb_set(jsonb_set(jsonb_set(merged, '{attrs}', d->'attrs', true), '{skills}', d->'skills', true),
                            '{_pointsAt}', to_jsonb(inc_pts), true);
        changed := true;
      end if;
      for sk in select jsonb_object_keys(d) loop
        continue when sk = any(skip_keys);
        sv := case when (in_keys->>sk) ~ '^[0-9]{1,18}$' then (in_keys->>sk)::bigint else 0 end;
        ev := case when (ex_keys->>sk) ~ '^[0-9]{1,18}$' then (ex_keys->>sk)::bigint else 0 end;
        if sv > ev then
          merged := jsonb_set(merged, array[sk], d->sk, true);
          mk := jsonb_set(mk, array[sk], to_jsonb(sv), true);
          changed := true;
        end if;
      end loop;
      if changed then
        merged := jsonb_set(merged, '{_keyAt}', mk, true);
        merged := jsonb_set(merged, '{_syncUpdatedAt}', to_jsonb(exst + 1), true);
        update public.a_profecia_players
           set data = merged, updated_at = to_timestamp((exst + 1) / 1000.0)
         where id = pid;
        select * into result_row from public.a_profecia_players where id = pid;
        return result_row;
      end if;
$r$);
  execute def;
end
$patch$;

-- ===== (2) Histórico no servidor =====
create table if not exists public.a_profecia_player_history (
  id bigint generated always as identity primary key,
  player_id text not null,
  saved_at timestamptz not null default now(),
  saved_by text,
  sync_stamp bigint,
  data jsonb not null
);
create index if not exists a_profecia_player_history_player_idx on public.a_profecia_player_history (player_id, saved_at desc);
alter table public.a_profecia_player_history enable row level security;   -- sem policies: só funções do servidor acessam
revoke all on table public.a_profecia_player_history from public, anon, authenticated;

create or replace function public.a_profecia_player_history_capture()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  last_row public.a_profecia_player_history;
  who text := nullif(current_setting('app.saved_by', true), '');
  newstamp bigint;
begin
  if tg_op = 'DELETE' then
    delete from public.a_profecia_player_history where player_id = old.id;
    return old;
  end if;
  if new.deleted_at is not null then
    delete from public.a_profecia_player_history where player_id = new.id;
    return new;
  end if;
  newstamp := coalesce((new.data->>'_syncUpdatedAt')::bigint, 0);

  select * into last_row from public.a_profecia_player_history
   where player_id = new.id order by saved_at desc, id desc limit 1;

  -- Nada mudou de verdade (ignora só o carimbo): não guarda de novo.
  if found and (last_row.data - '_syncUpdatedAt') = (new.data - '_syncUpdatedAt') then
    return new;
  end if;

  if found and last_row.saved_at > now() - interval '10 seconds' and last_row.saved_by is not distinct from who then
    update public.a_profecia_player_history
       set data = new.data, saved_at = now(), sync_stamp = newstamp
     where id = last_row.id;      -- junta rajadas (ex.: arrastar a vida) numa versão só
    return new;
  end if;

  insert into public.a_profecia_player_history(player_id, saved_by, sync_stamp, data)
  values (new.id, who, newstamp, new.data);

  -- Retenção: tudo nas últimas 24h; depois 1 por hora até 14 dias; depois 1 por dia.
  delete from public.a_profecia_player_history h
   where h.player_id = new.id
     and h.saved_at < now() - interval '24 hours'
     and h.saved_at >= now() - interval '14 days'
     and h.id not in (select distinct on (date_trunc('hour', x.saved_at)) x.id
                        from public.a_profecia_player_history x
                       where x.player_id = new.id and x.saved_at < now() - interval '24 hours'
                       order by date_trunc('hour', x.saved_at), x.saved_at desc);
  delete from public.a_profecia_player_history h
   where h.player_id = new.id
     and h.saved_at < now() - interval '14 days'
     and h.id not in (select distinct on (date_trunc('day', x.saved_at)) x.id
                        from public.a_profecia_player_history x
                       where x.player_id = new.id and x.saved_at < now() - interval '14 days'
                       order by date_trunc('day', x.saved_at), x.saved_at desc);
  return new;
end
$$;
revoke all on function public.a_profecia_player_history_capture() from public, anon, authenticated;

drop trigger if exists a_profecia_player_history_trg on public.a_profecia_players;
create trigger a_profecia_player_history_trg
  after insert or update of data, deleted_at or delete on public.a_profecia_players
  for each row execute function public.a_profecia_player_history_capture();

create or replace function public.a_profecia_sum_obj(j jsonb)
returns numeric
language sql immutable
as $$
  select coalesce(sum(value::numeric), 0)
    from jsonb_each_text(case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end)
   where value ~ '^-?[0-9]+(\.[0-9]+)?$'
$$;
revoke all on function public.a_profecia_sum_obj(jsonb) from public, anon, authenticated;

create or replace function public.a_profecia_player_history_list(p_token text, p_id text, p_limit int default 80)
returns table(id bigint, saved_at timestamptz, saved_by text, hp text, sanity text, attr_points numeric, skill_points numeric)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s public.a_profecia_sessions;
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  return query
    select h.id, h.saved_at, h.saved_by, h.data->>'hp', h.data->>'sanity',
           public.a_profecia_sum_obj(h.data->'attrs'), public.a_profecia_sum_obj(h.data->'skills')
      from public.a_profecia_player_history h
     where h.player_id = trim(coalesce(p_id, ''))
     order by h.saved_at desc, h.id desc
     limit greatest(1, least(coalesce(p_limit, 80), 300));
end
$$;

create or replace function public.a_profecia_player_history_get(p_token text, p_id text, p_history_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s public.a_profecia_sessions; out jsonb;
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then raise exception 'NAO_AUTORIZADO'; end if;
  select h.data into out from public.a_profecia_player_history h
   where h.id = p_history_id and h.player_id = trim(coalesce(p_id, ''));
  return out;
end
$$;

revoke all on function public.a_profecia_player_history_list(text, text, int) from public, authenticated;
revoke all on function public.a_profecia_player_history_get(text, text, bigint) from public, authenticated;
grant execute on function public.a_profecia_player_history_list(text, text, int) to anon;
grant execute on function public.a_profecia_player_history_get(text, text, bigint) to anon;

-- Ponto de partida: uma versão de cada Player ativo.
insert into public.a_profecia_player_history(player_id, saved_by, sync_stamp, data)
select p.id, 'baseline', coalesce((p.data->>'_syncUpdatedAt')::bigint, 0), p.data
  from public.a_profecia_players p
 where p.deleted_at is null
   and not exists (select 1 from public.a_profecia_player_history h where h.player_id = p.id);
