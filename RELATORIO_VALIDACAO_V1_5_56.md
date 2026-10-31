# Relatório de validação — Ashen Testimony V1.5.56

## Mudanças
- Reconciliação do roster de Players depois de reconexão Realtime, retorno à aba e recuperação da rede, com retry limitado.
- E2E de homologação aguarda 5 segundos após SUBSCRIBED e mantém a exigência estrita de 15 sessões recebendo 15 IDs distintos.
- Editor de terminais valida limites de anexos e só limpa o formulário depois que a releitura do servidor confirma o terminal.
- Incluídas duas migrações de reparo idempotentes: trigger Realtime de Players e esquema/RPCs de puzzles (base + áudio + arquivos corrompidos).

## Validações que passaram
- `node scripts/check-syntax.mjs`: 60 arquivos JavaScript.
- `node scripts/player-sync-regression.mjs`: 43 verificações.
- `node --test scripts/unit/*.test.mjs`: 145 testes, 0 falhas.
- `node scripts/stability-audit.mjs`: 23 verificações.
- `node scripts/xss-audit.mjs --check`: 21 achados conhecidos da baseline, 0 novos.
- `node --test scripts/chaos/network-chaos.test.mjs`: 10 testes, 0 falhas.
- Testes novos para reconciliação após reconexão, limites/confirmacão do editor de puzzles e migrações: 5 testes, 0 falhas (incluídos nos 145 acima).

## Pendências importantes
- `npm run build` **não passou** neste ambiente: `vite: not found`. Instale as dependências com `npm ci` no computador/CI antes de publicar.
- O E2E real de 15 sessões não foi executado, pois exige credenciais descartáveis e um Supabase isolado de homologação.
- As migrações SQL estão apenas dentro do ZIP; não foram executadas automaticamente.
- Portanto, a correção do Realtime e a capacidade real para 15 usuários ainda precisam ser confirmadas em homologação.

## Proteção de dados
Nenhuma migração foi executada, nenhum deploy foi feito e nenhum dado de produção foi alterado por esta revisão.
