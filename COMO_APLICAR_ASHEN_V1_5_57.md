# Como validar e publicar Ashen Testimony V1.5.57

## Antes de começar
1. Faça backup do projeto atual e guarde-o separado.
2. Extraia este ZIP em uma pasta nova; não sobrescreva a única cópia de trabalho.
3. Confirme as variáveis do Supabase: toda a primeira validação deve apontar para **homologação isolada**, com contas descartáveis, nunca para produção.

## Código e testes
1. Instale a versão de Node indicada em `package.json` (Node 22.x).
2. Execute `npm ci`.
3. Execute `npm run check`, `npm run test:player-backup`, `npm run test:sync`, `npm run test:unit`, `npm run stability:check`, `npm run audit:xss` e `npm run test:chaos`.
4. Execute `npm run build` e abra a versão compilada com `npm run preview`.
5. Verifique desktop, tablet e celular. Confirme todas as áreas: ficha do Player, Câmara do Mestre, mapa, biblioteca, diário, classes, Nexus, puzzles/terminais e telas de manutenção.

## Migrações — só em homologação primeiro
As migrações são arquivos de código e **não foram executadas automaticamente**. Em projeto descartável de homologação, faça backup antes e aplique, nesta ordem:
1. `supabase/migrations/20261027110000_player_realtime_repair.sql`
2. `supabase/migrations/20261027120000_session_puzzles_repair.sql`
3. `supabase/migrations/20261026000000_player_autobackup_and_dedicated_points.sql`

Confirme que todas concluem sem erro. Não execute em produção antes de terminar os testes abaixo e revisar o plano de migração.

## Cenários de aceite
- Abra a mesma ficha em dois navegadores e confirme que uma alteração confirmada no servidor aparece no outro.
- Desconecte a rede, altere um campo, reconecte e confirme que a alteração fica pendente até o servidor confirmar; não deve ser apresentada como salva antes disso.
- Atualize a página durante uma falha de rede e verifique que a fila/snapshot local não foi descartada.
- Faça logout/login com contas diferentes no mesmo dispositivo e confirme que a fila de uma conta não é enviada pela sessão de outra.
- Rode `npm run test:e2e:staging-sync` apenas com `ASHEN_TEST_*` de homologação e as 15 contas descartáveis exigidas pelo script.
- Teste salvar, reler, bloquear/desbloquear e validar os puzzles como Mestre e como Player; um Player não deve ver notas privadas, segredos nem conteúdo de outro puzzle/sessão.
- Confira o histórico/backup após editar, excluir logicamente e restaurar um Player.

## Publicação
Só publique depois de build, revisões, cenários manuais e E2E passarem em homologação. Mantenha o ZIP anterior e o backup do banco disponíveis para rollback controlado. Não altere nem apague dados existentes como parte de uma tentativa de corrigir Realtime.
