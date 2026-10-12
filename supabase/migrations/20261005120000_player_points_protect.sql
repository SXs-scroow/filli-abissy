-- Ashen Testimony: protege os PONTOS (attrs/skills) do Player contra gravações atrasadas.
-- Antes: se outro aparelho (ex.: Mestre) gravasse a ficha inteira com uma cópia antiga, ou se o carimbo
-- geral do servidor fosse mais novo, o salvamento do Player era descartado em silêncio e os pontos "sumiam".
-- Agora os pontos têm carimbo próprio (_pointsAt): vence quem tiver os pontos mais novos.
create or replace function public.a_profecia_player_save(
  p_token text, p_id text, p_login text, p_data jsonb, p_sync_updated_at bigint,
  p_deleted_at timestamptz default null)
returns public.a_profecia_players
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  s public.a_profecia_sessions;
  existing public.a_profecia_players;
  result_row public.a_profecia_players;
  pid text := trim(coalesce(p_id,''));
  lg text := trim(coalesce(p_login,''));
  stamp bigint := coalesce(p_sync_updated_at, (extract(epoch from clock_timestamp()) * 1000)::bigint);
  d jsonb;
  newpw text;
  legacypw text;
  k text;
  had boolean;
  inc_pts bigint := 0;
  ex_pts bigint := 0;
begin
  s := public.a_profecia_auth(p_token);

  if pid = '' or lg = '' then
    raise exception 'Player sem id ou login';
  end if;

  if s.role = 'player' and (s.player_id is distinct from pid or p_deleted_at is not null) then
    raise exception 'NAO_AUTORIZADO';
  end if;

  if octet_length(coalesce(p_data,'{}'::jsonb)::text) > 2000000 then
    raise exception 'DADOS_GRANDES';
  end if;

  select * into existing
  from public.a_profecia_players
  where id = pid
  for update;

  had := found;

  if had and existing.deleted_at is not null and p_deleted_at is null then
    raise exception 'PLAYER_EXCLUIDO';
  end if;

  newpw := nullif(p_data->>'newPassword', '');
  legacypw := nullif(p_data->>'password', '');
  d := coalesce(p_data, '{}'::jsonb) - 'password' - 'newPassword';

  if s.role = 'player' and had then
    lg := existing.login;
    foreach k in array array['masterNotes','attrBonusPoints','skillBonusPoints'] loop
      if existing.data ? k then
        d := jsonb_set(d, array[k], existing.data->k, true);
      else
        d := d - k;
      end if;
    end loop;
  end if;

  -- Carimbos dos pontos (apenas dígitos; qualquer outra coisa conta como 0).
  if (d->>'_pointsAt') ~ '^[0-9]{1,18}$' then inc_pts := (d->>'_pointsAt')::bigint; end if;
  if had and (existing.data->>'_pointsAt') ~ '^[0-9]{1,18}$' then ex_pts := (existing.data->>'_pointsAt')::bigint; end if;

  -- Cópia antiga tentando sobrescrever pontos mais novos: mantém os pontos que já estão salvos.
  if had and inc_pts < ex_pts
     and jsonb_typeof(existing.data->'attrs') = 'object'
     and jsonb_typeof(existing.data->'skills') = 'object' then
    d := jsonb_set(d, '{attrs}', existing.data->'attrs', true);
    d := jsonb_set(d, '{skills}', existing.data->'skills', true);
    d := jsonb_set(d, '{_pointsAt}', to_jsonb(ex_pts), true);
  end if;

  if s.role = 'master' and newpw is not null then
    if length(newpw) < 4 or length(newpw) > 72 then raise exception 'SENHA_INVALIDA'; end if;
    insert into public.a_profecia_player_secrets(player_id, password_hash)
      values (pid, crypt(newpw, gen_salt('bf', 10)))
      on conflict (player_id) do update
        set password_hash = excluded.password_hash, updated_at = now();
    delete from public.a_profecia_sessions where role = 'player' and player_id = pid;
  elsif legacypw is not null
    and not exists (select 1 from public.a_profecia_player_secrets where player_id = pid) then
    insert into public.a_profecia_player_secrets(player_id, password_hash)
      values (pid, crypt(legacypw, gen_salt('bf', 10)))
      on conflict (player_id) do nothing;
  end if;

  if had then
    if coalesce((existing.data->>'_syncUpdatedAt')::bigint,
                (extract(epoch from existing.updated_at) * 1000)::bigint, 0) > stamp then
      -- O carimbo geral é mais antigo, então o resto da ficha continua como está no servidor.
      -- Mas se estes pontos são MAIS NOVOS que os salvos, eles não podem ser descartados.
      if inc_pts > ex_pts
         and jsonb_typeof(d->'attrs') = 'object'
         and jsonb_typeof(d->'skills') = 'object' then
        update public.a_profecia_players
           set data = jsonb_set(jsonb_set(jsonb_set(existing.data, '{attrs}', d->'attrs', true),
                                          '{skills}', d->'skills', true),
                                '{_pointsAt}', to_jsonb(inc_pts), true)
         where id = pid;
        select * into result_row from public.a_profecia_players where id = pid;
        return result_row;
      end if;
      return existing;
    end if;
  end if;

  d := jsonb_set(d, '{_syncUpdatedAt}', to_jsonb(stamp), true);

  insert into public.a_profecia_players(id, login, data, updated_at, deleted_at)
  values (pid, lg, d, to_timestamp(stamp / 1000.0), p_deleted_at)
  on conflict (id) do update
    set login = excluded.login,
        data = excluded.data,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    where coalesce((public.a_profecia_players.data->>'_syncUpdatedAt')::bigint,
                   (extract(epoch from public.a_profecia_players.updated_at) * 1000)::bigint, 0) <= stamp;

  if p_deleted_at is not null then
    delete from public.a_profecia_sessions where role = 'player' and player_id = pid;
    delete from public.a_profecia_player_secrets where player_id = pid;
  end if;

  select * into result_row
  from public.a_profecia_players
  where id = pid;

  return result_row;
end
$function$;
