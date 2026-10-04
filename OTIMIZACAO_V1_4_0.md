# A Profecia — V1.4.0 Recuperação e Integridade

- Conflitos de Player: fila local guarda uma base conhecida e, quando o servidor rejeita uma gravação por carimbo antigo, a alteração local é mesclada por campo sobre o estado remoto antes de um novo envio.
- Auditoria local: ações críticas (snapshot manual, exportação, integridade e restauração) recebem registro local no IndexedDB.
- Snapshot/recuperação local já existente foi reforçado com auditoria.
- Exportação de emergência da campanha em JSON foi adicionada à área Recuperação.
- Verificação de integridade detecta Players sem ID, IDs duplicados e logins inválidos antes de uma sessão.
- Restauração segura de Player foi aplicada ao Supabase de produção na migration `20261001121249_player_restore_safe`.
- O banco de produção mantém 27 Players; nenhuma linha de Player foi apagada durante esta atualização.
- O histórico existente `a_profecia_players_history` continua preservado.

Validação local:
- 22/22 arquivos JavaScript com sintaxe válida.
- Stability audit: 17/17.
- Player sync regression: 27/27.
- Unit tests: 32/32.
- XSS audit: 0 novas ocorrências.
- Build Vite: não concluído neste ambiente; `npm install` excedeu o limite de execução.

Validação Supabase:
- Projeto ativo e saudável.
- Migration de restauração aplicada com sucesso.
- Advisors de performance: nenhum finding.
- Advisors de segurança ainda reportam os padrões de RLS sem policies e SECURITY DEFINER acessível por `anon`. O aplicativo usa RPCs com autenticação própria por token; essas rotinas devem permanecer assim até uma migração completa para o modelo de autorização do Supabase, para não quebrar o login atual.
