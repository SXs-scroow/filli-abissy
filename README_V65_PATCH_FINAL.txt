A PROFECIA — V65 + PATCH FINAL

Correções principais desta versão:

1. Players
- Players persistem em public.a_profecia_players, uma linha por personagem.
- Sincronização por personagem, não por substituição da lista inteira.
- Proteção por _syncUpdatedAt contra clientes/estados antigos sobrescrevendo dados novos.
- Tombstones para exclusões.
- Login consulta o banco quando a cópia local não contém o Player.
- Sessão de Player não é mais invalidada só porque uma sincronização momentânea deixou a lista local incompleta.
- Snapshot de sessão evita retorno indevido à tela inicial durante uma sincronização.
- Histórico automático em public.a_profecia_players_history para recuperação.

2. Atributos e Perícias
- Alterações não salvas ficam preservadas como rascunho.
- Salvar Atributos não apaga Perícias digitadas.
- Salvar Perícias não apaga Atributos digitados.
- Outros botões que reconstruam a ficha também preservam o rascunho.
- Ao salvar definitivamente Atributos ou Perícias, ambos os valores atuais são validados antes de serem gravados.

3. Dados
- O resultado permanece na ficha após múltiplas rolagens.
- O histórico continua salvo no Player.
- Atualizações realtime não reconstruem a ficha do Player a cada rolagem, evitando que o resultado visual desapareça.
- Expressões como d10+6, 2d6 e 1d20-2 continuam funcionando.

4. Navegação / sessão
- A aplicação não manda mais automaticamente um Player para o login apenas porque a lista de Players sofreu uma atualização transitória.
- Exclusão real do Player pelo Mestre continua encerrando a sessão daquele Player.

5. Banco
Execute no Supabase:
SUPABASE_V65_PATCH_COMPLETO.sql

Esse arquivo inclui o banco global, tabela de Players, migração dos Players antigos, proteção server-side contra sobrescrita antiga, histórico e Realtime.

Observação de segurança:
O projeto atual ainda usa login próprio da aplicação. O próximo salto de segurança seria migrar a autenticação para Supabase Auth, mas isso não é necessário para as correções de persistência desta versão.
