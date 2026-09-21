-- A PROFECIA V66 — FASE 2: FECHAR A ESCRITA PÚBLICA E APAGAR AS SENHAS EM TEXTO PURO
-- ⚠️ SÓ RODE DEPOIS DE: (1) publicar o site V66.1 e (2) trocar a senha do Mestre pelo botão "🔑 Senha do Mestre".
-- Depois desta fase, versões antigas do site (em cache no navegador) deixam de conseguir gravar.

-- 0) Trava de segurança: recusa rodar se a senha do Mestre ainda for a antiga (que ficou pública no código antigo).
do $$
begin
  if exists (select 1 from public.a_profecia_secrets
             where k = 'master_password_hash' and extensions.crypt('Amarantos1805', v) = v) then
    raise exception 'Troque a senha do Mestre antes (Câmara do Mestre > Players > Senha do Mestre).';
  end if;
end $$;

-- 1) Garante que todo Player que ainda tem senha em texto puro tenha o hash certo antes de apagar o texto.
insert into public.a_profecia_player_secrets(player_id, password_hash)
select id, extensions.crypt(data->>'password', extensions.gen_salt('bf', 10))
from public.a_profecia_players
where coalesce(data->>'password','') <> '' and deleted_at is null
on conflict (player_id) do nothing;
update public.a_profecia_player_secrets s
set password_hash = extensions.crypt(p.data->>'password', extensions.gen_salt('bf', 10)), updated_at = now()
from public.a_profecia_players p
where p.id = s.player_id and coalesce(p.data->>'password','') <> ''
  and extensions.crypt(p.data->>'password', s.password_hash) <> s.password_hash;

-- 2) Apaga as senhas em texto puro: nas fichas e em todo o histórico.
update public.a_profecia_players set data = data - 'password' where data ? 'password';
update public.a_profecia_players_history set snapshot = snapshot #- '{data,password}' where snapshot #> '{data}' ? 'password';
update public.a_profecia_players_history set snapshot = snapshot - 'password' where snapshot ? 'password';

-- 3) Fecha a escrita pública. A leitura continua aberta (o tempo real precisa dela); escrever só pelas funções a_profecia_*.
drop policy if exists "public insert global"  on public.a_profecia_global;
drop policy if exists "public write global"   on public.a_profecia_global;
drop policy if exists "public update global"  on public.a_profecia_global;
drop policy if exists "public insert players" on public.a_profecia_players;
drop policy if exists "public update players" on public.a_profecia_players;
revoke insert, update, delete on public.a_profecia_global, public.a_profecia_players from anon, authenticated;

-- 4) A função antiga (sem autenticação) deixa de existir para o público.
revoke execute on function public.a_profecia_upsert_player(text, text, jsonb, bigint, timestamptz) from public, anon, authenticated;
