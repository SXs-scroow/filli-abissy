# V1.5.8 — fechamento de lacunas (revisão estática)

## Histórico de Players
- A interface agora diferencia sessão expirada, permissão insuficiente, função RPC ausente, falha de rede e Supabase não configurado.
- Se aparecer o aviso de funções ausentes, verificar no Supabase se a migração `20261005140000_player_history_and_field_merge.sql` foi aplicada ao projeto correto.
- A migração cria tabela, trigger de captura, funções de listagem e leitura, além de registros de baseline. Não aplicar cegamente em produção: revisar o SQL e confirmar o ambiente antes.
- O histórico só captura alterações feitas na tabela `a_profecia_players`. Alterações que permanecem apenas no estado global/local não aparecerão como versões da ficha.

## Sincronização
- O coordenador em `src/syncCoordinator.js` serializa snapshots globais e conserva uma gravação pendente no armazenamento local para novas tentativas.
- Isso não substitui uma estratégia de conflito no servidor. Como `a_profecia_push_global` grava um documento global, duas instâncias do Mestre/dispositivos podem sobrescrever dados com snapshots completos. Não permitir dois Mestres gravando simultaneamente até haver controle de versão/compare-and-swap no banco.
- Confirmar no navegador o evento `a-profecia-sync-queue` e o estado `a-profecia-sync-status`; o indicador `saved`/`synced` deve ocorrer apenas após resposta bem-sucedida do RPC.
- `localStorage` pode falhar por quota ou políticas do navegador. A aplicação avisa no console, mas o salvamento pendente não é durável nesses casos. Backups externos e teste de restauração continuam necessários.

## Verificação obrigatória no ambiente do projeto
1. Aplicar/confirmar as migrações no projeto Supabase correto.
2. Abrir histórico de um Player existente e confirmar baseline e uma nova versão após alterar/salvar a ficha.
3. Desconectar a rede, editar um campo, reconectar e verificar que a fila esvazia após confirmação do servidor.
4. Testar com dois navegadores/dispositivos antes de declarar sincronização sem conflitos.
5. Executar `npm ci` e `npm run release:check` no notebook. Esta revisão estática não comprova o build nem a integração com o Supabase remoto.
