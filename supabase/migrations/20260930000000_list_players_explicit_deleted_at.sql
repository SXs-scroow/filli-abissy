-- A Profecia: exclusão EXPLÍCITA também para o Player (2026-09-30).
--
-- Problema: a leitura do Player filtrava `deleted_at is null`; uma ficha excluída
-- simplesmente sumia e o front-end não distinguia "excluída" de "a leitura não
-- trouxe a linha" (falha de rede, replicação atrasada).
--
-- Solução (sem ampliar nenhum privilégio):
--  * As sessões do Player excluído continuam sendo APAGADAS (a_profecia_auth,
--    whoami, upload-asset e todas as outras RPCs continuam rejeitando o token).
--  * Um trigger guarda só o hash desse token numa tabela de "sessões revogadas".
--  * a_profecia_list_players aceita esse token revogado EXCLUSIVAMENTE para devolver
--    a própria linha com `deleted_at` preenchido. Não serve para mais nada.
--  * a_profecia_player_delete e a_profecia_player_save NÃO são alteradas.

create table if not exists public.a_profecia_revoked_player_sessions (
  token_hash text primary key,
  player_id  text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz not null default now()
);
alter table public.a_profecia_revoked_player_sessions enable row level security;
revoke all on table public.a_profecia_revoked_player_sessions from public, anon, authenticated;

create or replace function public.a_profecia_remember_revoked_player_session()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  if old.role = 'player'
     and old.player_id is not null
     and old.expires_at > now()
     and exists (select 1 from public.a_profecia_players p
                  where p.id = old.player_id and p.deleted_at is not null) then
    insert into public.a_profecia_revoked_player_sessions(token_hash, player_id, expires_at)
    values (old.token_hash, old.player_id, old.expires_at)
    on conflict (token_hash) do nothing;
  end if;
  -- limpeza barata: tokens revogados vencidos não servem mais
  delete from public.a_profecia_revoked_player_sessions where expires_at <= now();
  return old;
end
$function$;

revoke all on function public.a_profecia_remember_revoked_player_session() from public, anon, authenticated;

drop trigger if exists a_profecia_sessions_remember_revoked on public.a_profecia_sessions;
create trigger a_profecia_sessions_remember_revoked
before delete on public.a_profecia_sessions
for each row execute function public.a_profecia_remember_revoked_player_session();

create or replace function public.a_profecia_list_players(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.a_profecia_sessions;
  result jsonb;
  revoked_pid text;
begin
  begin
    s := public.a_profecia_auth(p_token);
  exception when others then
    if sqlerrm is distinct from 'SESSAO_INVALIDA' then raise; end if;
    -- Token de um Player que foi excluído: só pode ler a PRÓPRIA tombstone.
    select r.player_id into revoked_pid
      from public.a_profecia_revoked_player_sessions r
     where r.token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex')
       and r.expires_at > now();
    if revoked_pid is null then raise exception 'SESSAO_INVALIDA'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id,
             'login', p.login,
             'data', jsonb_build_object('_syncUpdatedAt', p.data->'_syncUpdatedAt'),
             'updated_at', p.updated_at,
             'deleted_at', p.deleted_at)), '[]'::jsonb)
      into result
      from public.a_profecia_players p
     where p.id = revoked_pid and p.deleted_at is not null;
    return result;
  end;

  if s.role = 'master' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'login', p.login,
          'data', (p.data - 'password' - 'newPassword'),
          'updated_at', p.updated_at,
          'deleted_at', p.deleted_at
        ) order by p.updated_at asc
      ), '[]'::jsonb
    ) into result
    from public.a_profecia_players p;
  else
    -- Player com sessão válida: a própria linha, inclusive se estiver excluída
    -- (nesse caso sem o conteúdo da ficha, só o carimbo de sync).
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'login', p.login,
          'data', case when p.deleted_at is null
                       then (p.data - 'password' - 'newPassword')
                       else jsonb_build_object('_syncUpdatedAt', p.data->'_syncUpdatedAt') end,
          'updated_at', p.updated_at,
          'deleted_at', p.deleted_at
        )
      ), '[]'::jsonb
    ) into result
    from public.a_profecia_players p
    where p.id = s.player_id;
  end if;

  return result;
end
$$;

revoke all on function public.a_profecia_list_players(text) from public, authenticated;
grant execute on function public.a_profecia_list_players(text) to anon;
