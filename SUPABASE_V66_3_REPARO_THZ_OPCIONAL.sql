-- OPCIONAL. Só rode se preferir restaurar a senha ANTIGA do jogador Thz em vez de definir uma nova pelo painel do Mestre.
-- Pega a última senha em texto puro que ficou no histórico e grava o hash (bcrypt) no servidor. Não mostra a senha.
insert into public.a_profecia_player_secrets (player_id, password_hash)
select 'p-1789936672151-2z084', extensions.crypt(h.snapshot->'data'->>'password', extensions.gen_salt('bf', 10))
from (
  select snapshot from public.a_profecia_players_history
  where player_id = 'p-1789936672151-2z084' and snapshot->'data'->>'password' is not null
  order by recorded_at desc limit 1
) h
on conflict (player_id) do nothing;
-- Conferir: select player_id from public.a_profecia_player_secrets where player_id = 'p-1789936672151-2z084';
