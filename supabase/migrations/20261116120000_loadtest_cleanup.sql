-- Ashen Testimony: limpeza das fichas descartáveis criadas pelo teste de carga ponta a ponta.
-- Só o Mestre pode chamar, e só apaga ids que começam com "__loadtest_".
create or replace function public.a_profecia_loadtest_cleanup(p_token text, p_run text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  s public.a_profecia_sessions;
  pat text;
  n_players integer := 0;
  n_history integer := 0;
  n_points integer := 0;
  n_secrets integer := 0;
begin
  s := public.a_profecia_auth(p_token);
  if s.role <> 'master' then
    raise exception 'NAO_AUTORIZADO';
  end if;
  if p_run is not null and p_run !~ '^[a-z0-9]{4,24}$' then
    raise exception 'RUN_INVALIDO';
  end if;

  -- "\_" escapa o sublinhado: só ids literalmente iniciados por __loadtest_ entram.
  pat := '\_\_loadtest\_' || case when p_run is null then '' else p_run || '\_' end || '%';

  delete from public.a_profecia_players where id like pat;
  get diagnostics n_players = row_count;

  -- O gatilho de histórico também registra exclusões, por isso limpa depois.
  delete from public.a_profecia_player_history where player_id like pat;
  get diagnostics n_history = row_count;
  -- Tabela de auditoria mais antiga, alimentada por outro gatilho; pode não existir em todos os ambientes.
  if to_regclass('public.a_profecia_players_history') is not null then
    execute 'delete from public.a_profecia_players_history where player_id like $1' using pat;
  end if;
  delete from public.a_profecia_player_points where player_id like pat;
  get diagnostics n_points = row_count;
  delete from public.a_profecia_player_secrets where player_id like pat;
  get diagnostics n_secrets = row_count;
  delete from public.a_profecia_sessions where role = 'player' and player_id like pat;

  return jsonb_build_object('players', n_players, 'history', n_history, 'points', n_points, 'secrets', n_secrets, 'run', p_run);
end
$function$;

revoke all on function public.a_profecia_loadtest_cleanup(text, text) from public, authenticated;
grant execute on function public.a_profecia_loadtest_cleanup(text, text) to anon;
