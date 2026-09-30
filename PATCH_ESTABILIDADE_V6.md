# A Profecia — Patch V6: exclusão explícita + teste de rede instável

## 1. `a_profecia_list_players` devolve `deleted_at` também ao Player
Migration: `supabase/migrations/20260930000000_list_players_explicit_deleted_at.sql`

- O Player recebe sempre a PRÓPRIA linha; se excluída, vem com `deleted_at` (sem o conteúdo
  da ficha, só o carimbo). Ausência de linha deixou de significar exclusão.
- **Sem ampliar privilégios:** as sessões do Player excluído continuam APAGADAS
  (`a_profecia_auth`, `whoami` e a Edge Function `upload-asset` seguem barrando o token).
  Um trigger guarda só o hash do token numa tabela de sessões revogadas, e esse token
  revogado serve exclusivamente para `list_players` devolver a própria exclusão.
- `a_profecia_player_delete` e `a_profecia_player_save` NÃO foram alteradas.
- `subscribePlayers`: ausência na leitura não vira mais "exclusão" inventada; só um DELETE
  físico anunciado pelo trigger (`op = 'delete'`) gera o marcador `deleted`.
- `confirmPlayerDeletion` nunca conseguia confirmar para um Player; agora confirma.

## 2. Teste de rede instável — `npm run test:chaos`
`scripts/chaos/`: servidor de teste + proxy que destrói o socket (no meio do envio, no meio
da resposta, ou depois de o servidor aplicar). Executa o `playerStore.js` e as funções de sync
do `app.js` REAIS. 10 cenários (corte no upload, resposta perdida, corte na leitura, leitura
vazia, exclusão explícita, segurança do token revogado, edição pendente em ficha excluída,
Mestre com exclusão interrompida, Realtime).

## 3. Validação do SQL no banco real
A migration foi executada no Postgres do projeto dentro de uma transação com erro forçado
(rollback), com 13 verificações — todas OK. Produção não foi alterada por esse teste.
Limite: o servidor de teste do item 2 modela o contrato; o SQL foi validado à parte (item 3).
