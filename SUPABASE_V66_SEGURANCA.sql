-- A PROFECIA V66 — endurecimento do Supabase (seguro de rodar; não muda o funcionamento atual do site)
-- Rode UMA vez no SQL Editor. Pode rodar de novo sem problema.

-- 1) O site nunca apaga arquivos do Storage (só envia/substitui). Então ninguém precisa poder apagar.
--    Antes, qualquer visitante com a chave pública podia apagar todos os fundos/músicas/retratos.
drop policy if exists "public delete assets" on storage.objects;

-- 2) Limite de tamanho por arquivo no bucket (50 MB = teto do plano gratuito) e só tipos de mídia.
--    SVG/HTML ficam de fora de propósito (poderiam carregar script).
--    Se algum upload legítimo for recusado por tipo, acrescente o tipo na lista abaixo.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/png','image/jpeg','image/webp','image/gif','image/avif',
      'audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/webm','audio/mp4','audio/aac','audio/x-m4a',
      'video/mp4','video/webm'
    ]
where id = 'a-profecia-assets';

-- 3) Garante que a tabela de histórico continua fechada para o público (só o trigger escreve nela).
alter table public.a_profecia_players_history enable row level security;
drop policy if exists "public read player history" on public.a_profecia_players_history;
drop policy if exists "public write player history" on public.a_profecia_players_history;

-- 4) Backups do estado global (linhas backup-*) não podem ser sobrescritos, só criados.
create or replace function public.a_profecia_block_backup_update()
returns trigger language plpgsql as $$
begin
  if old.id like 'backup-%' then
    raise exception 'Backups do estado global são imutáveis';
  end if;
  return new;
end $$;
drop trigger if exists a_profecia_block_backup_update_trg on public.a_profecia_global;
create trigger a_profecia_block_backup_update_trg
before update on public.a_profecia_global
for each row execute function public.a_profecia_block_backup_update();

-- ---------------------------------------------------------------------------
-- O QUE ESTE ARQUIVO NÃO RESOLVE (precisa de mudança maior no app, feita com teste):
--  • As tabelas a_profecia_global e a_profecia_players ainda aceitam leitura E escrita com a chave pública
--    (que aparece no código do site). Isso significa que quem abrir o DevTools consegue ler as senhas dos
--    Players (ficam em texto puro em data->>'password') e alterar qualquer ficha.
--  • Caminho recomendado: Supabase Auth (login do Mestre e dos Players) + policies "auth.uid() = dono" e
--    "Mestre pode tudo". Depois disso, remover a escrita pública de vez.
-- ---------------------------------------------------------------------------
