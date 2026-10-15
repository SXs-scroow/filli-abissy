# Patch de estabilidade — V1.5.12

## Correções

- Adicionada uma migração de recuperação para `a_profecia_get_players_by_ids`, RPC chamada pelo cliente durante eventos de Realtime.
- A RPC mantém a leitura restrita ao próprio Player; o Mestre só consulta os IDs pedidos.
- Token revogado após exclusão pode consultar exclusivamente a tombstone do próprio personagem, sem restaurar a sessão nem ganhar permissão de gravação.
- O servidor de teste de caos agora implementa essa RPC e reproduz o contrato de autorização, incluindo a leitura limitada da tombstone.

## Aplicação

A migração `supabase/migrations/20261013000000_fix_targeted_player_realtime.sql` precisa ser aplicada ao projeto Supabase remoto. O código local sozinho não cria funções no banco remoto.

## Verificações executadas

- `node scripts/check-syntax.mjs` — passou.
- `node scripts/stability-audit.mjs` — 17 verificações passaram.
- `node scripts/player-sync-regression.mjs` — 27 verificações passaram.
- `node --test scripts/unit/*.test.mjs` — 66 testes passaram.

O teste de caos e o build não foram reexecutados neste ambiente porque as dependências npm não estavam instaladas e a instalação excedeu o tempo limite. Execute `npm install` e depois `npm run release:check` no ambiente do projeto para concluir a validação integral.
