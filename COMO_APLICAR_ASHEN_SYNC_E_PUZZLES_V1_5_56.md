# Ashen Testimony V1.5.56 — sincronização resiliente + reparo de puzzles

## O que mudou no código

- `src/playerStore.js`: após uma reconexão Realtime, retorno da aba ou recuperação da rede, o cliente reconcilia a lista com o servidor. O Broadcast continua sendo o caminho rápido; a releitura evita ficar indefinidamente com dados antigos quando eventos foram perdidos durante uma queda.
- `scripts/e2e/staging-sync-load.mjs`: aguarda 5 segundos depois que as 15 sessões Realtime entram no canal antes de começar as escritas. O teste continua exigindo que todas as sessões recebam os 15 eventos distintos; a espera não transforma uma falha em sucesso.
- `app.js`: salvar um terminal agora valida limites de anexos e só limpa o editor depois que a releitura do servidor confirma o terminal. Se a confirmação não vier, os dados continuam no editor para tentativa/revisão.

## Migrações incluídas

1. `supabase/migrations/20261027110000_player_realtime_repair.sql` — recria idempotentemente o trigger Broadcast de Players. Não altera linhas de fichas.
2. `supabase/migrations/20261027120000_session_puzzles_repair.sql` — reaplica em ordem o esquema/RPCs das três migrações de puzzles já existentes (base, áudio, arquivos corrompidos). Usa `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` e `CREATE OR REPLACE FUNCTION`; não apaga puzzles nem tentativas.

## Ordem segura de validação

1. Faça backup do projeto e confirme que está no **Supabase de homologação**, não no projeto de produção.
2. No SQL Editor da homologação, execute `20261027110000_player_realtime_repair.sql`.
3. Execute `20261027120000_session_puzzles_repair.sql` na mesma homologação.
4. Publique os arquivos do ZIP em um branch/preview, instale dependências e execute `npm run release:check`.
5. Configure as variáveis do E2E somente para as 15 contas descartáveis de homologação e execute `npm run test:e2e:staging-sync`.
6. Teste em dois navegadores: alterar HP em um, confirmar o outro; desconectar/reconectar; editar, desativar, desbloquear e excluir um terminal; conferir que conteúdo secreto não aparece para outro Player nem no estado global.
7. Só depois de todos os testes passarem, planeje separadamente a aplicação das migrações em produção.

## Limites conhecidos

- Não foi feito deploy e nenhuma migração foi executada automaticamente.
- A espera de 5 segundos do teste é mitigação para inicialização fria, não prova por si só que o Realtime está corrigido.
- A capacidade real para 15 usuários só fica confirmada quando o E2E roda contra homologação isolada e passa.
