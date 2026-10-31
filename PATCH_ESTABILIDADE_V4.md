# A Profecia — Patch de Estabilidade V4

## Objetivo

Corrigir a consistência do roster de Players entre navegador, cache local, Realtime e Supabase sem reconstruir o site nem apagar dados existentes.

## Alterações principais

- Exclusão de Player agora é confirmada por uma RPC dedicada no servidor.
- Exclusões passam a ser terminais: uma ficha marcada como excluída não pode ser reativada por um `save` atrasado.
- Trigger no PostgreSQL impede qualquer `deleted_at -> null` depois de uma exclusão.
- Roster do Mestre usa o armazenamento dedicado de Players como fonte oficial.
- Cache confirmado guarda também os IDs excluídos para evitar ressuscitação durante fallback offline.
- Players novos encontrados no Supabase são incorporados ao estado local.
- Players locais ausentes de um roster remoto completo não são recriados automaticamente.
- Realtime agrupa vários eventos próximos para não perder alterações em rajadas.
- F5/pageshow/retorno da aba dispara reconciliação do roster.
- Há botão `Sincronizar agora` na área de Players do Mestre.
- A UI mostra o horário da última sincronização confirmada.
- A reconciliação evita regravar fichas quando não houve mudança real.
- Novas fichas criadas pelo Mestre ficam marcadas como `_pendingCreate` até a confirmação no servidor.
- `playerRowStamp` usa o maior carimbo disponível (`updated_at` / `_syncUpdatedAt`).
- Marcadores de exclusão sintéticos do Realtime são tratados corretamente.
- Senhas novas são removidas da memória local imediatamente após cada gravação confirmada.
- Cache-busting do app foi atualizado para 1500.
- Foi adicionado `npm run stability:check` para validações estáticas antes do build.

## Banco de dados

A migration `supabase/migrations/20260927000000_player_delete_integrity.sql` contém a função de exclusão e a proteção contra undelete. A mesma alteração já foi aplicada ao projeto Supabase de produção durante este patch.

## Validação realizada

- `node scripts/check-syntax.mjs` — OK, 7 arquivos JavaScript.
- `node scripts/stability-audit.mjs` — OK, 10 verificações.
- Trigger anti-undelete testado em uma linha já excluída sem alterar os dados.
- Advisors de performance do Supabase — sem findings.

O build de produção deve ser executado no ambiente que possui as dependências do projeto:

```bash
npm install
npm run release:check
```

O `release:check` executa o check de sintaxe, a auditoria de estabilidade e o `npm run build`.
