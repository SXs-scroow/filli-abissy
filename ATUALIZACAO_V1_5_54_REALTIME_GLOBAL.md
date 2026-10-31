# Ashen Testimony V1.5.54 — correção de aviso Realtime global

## Problema identificado
A assinatura de mudanças globais usava um nome de canal construído com `Date.now()`, que mudava por aba. Não havia emissor no código do projeto que pudesse publicar nesse tópico aleatório; desse modo, a atualização global podia depender do polling periódico.

## Correção
- `subscribeGlobal` agora escuta `global-changed` no canal compartilhado `a-profecia-live-v2`.
- Após o Supabase confirmar `a_profecia_push_global`, o cliente envia uma notificação Realtime `global-changed` pelo mesmo canal.
- O aviso é complementar: falhar ao publicar o evento não transforma uma gravação já confirmada em falha. O polling existente continua sendo o mecanismo de recuperação.
- A auditoria de sincronização verifica o tópico compartilhado, o emissor após a confirmação e a inscrição no evento global.
- Foi adicionado um roteiro E2E de homologação para 15 sessões independentes, gravações concorrentes, confirmação por Realtime e restauração do HP das fichas descartáveis.

## Segurança e escopo
- Nenhuma migração SQL foi executada.
- Nenhum dado foi gravado, modificado ou removido no Supabase de produção por esta alteração.
- Nenhuma funcionalidade de RPG foi removida.
- O E2E não usa produção por padrão e exige uma confirmação explícita de homologação; não foi executado nesta revisão, pois não havia credenciais nem um projeto isolado disponíveis.

## Validação local
- Sintaxe JavaScript: passou em 58 arquivos, incluindo o novo script E2E.
- Testes unitários: 138 passaram, 0 falharam.
- Regressão de sincronização: 42 verificações passaram.
- Auditoria de estabilidade: 23 verificações passaram.
- Testes da API de manutenção: passaram.
- Testes de caos de rede: 10 passaram, 0 falharam.
- Auditoria XSS: 21 ocorrências já conhecidas na baseline, 0 novas.
- `scope-check`: pulado porque a dependência opcional TypeScript não está instalada.
- `npm run build`: não executou, pois `vite` não está instalado. A instalação foi bloqueada por erro de DNS `EAI_AGAIN` ao acessar `registry.npmjs.org`.

## Limite do que foi comprovado
A correção do evento Realtime e os testes locais não certificam, por si só, que 15 usuários reais funcionam sem falhas. Essa conclusão exige executar o E2E em homologação, depois compilar o pacote e testar a versão compilada. O relatório E2E deve ser revisado antes de qualquer deploy.
