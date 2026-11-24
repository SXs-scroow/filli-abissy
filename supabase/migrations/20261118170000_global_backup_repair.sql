-- Garante que o backup global usado pelo painel de Recuperação exista no banco.
-- Backups são gravados na mesma tabela do estado global, com IDs próprios; a
-- leitura continua restrita ao RPC de Mestre já existente.

create or replace function public.a_profecia_backup_global(
  p_token text,
  p_data jsonb,
  p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  backup_id text;
  created_at timestamptz := clock_timestamp();
  snapshot jsonb;
begin
  s := public.a_profecia_auth(p_token);
  if s.role is distinct from 'master' then
    raise exception 'NAO_AUTORIZADO';
  end if;

  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'BACKUP_GLOBAL_INVALIDO';
  end if;

  backup_id := 'backup-' ||
    to_char(created_at at time zone 'utc', 'YYYYMMDDHH24MISSMS') || '-' ||
    substr(md5(random()::text || created_at::text), 1, 10);

  snapshot := (p_data - '__backup') || jsonb_build_object(
    '__backup', jsonb_build_object(
      'label', left(coalesce(nullif(trim(p_label), ''), 'automatico'), 100),
      'createdAt', created_at,
      'version', 1
    )
  );

  insert into public.a_profecia_global (id, data, updated_at)
  values (backup_id, snapshot, created_at);

  -- Mantém os 50 backups mais recentes para evitar crescimento sem limite.
  delete from public.a_profecia_global
  where id like 'backup-%'
    and id not in (
      select id
      from public.a_profecia_global
      where id like 'backup-%'
      order by updated_at desc
      limit 50
    );

  return jsonb_build_object('id', backup_id, 'updated_at', created_at);
end
$function$;

revoke all on function public.a_profecia_backup_global(text, jsonb, text) from public, authenticated;
grant execute on function public.a_profecia_backup_global(text, jsonb, text) to anon;
