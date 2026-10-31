# Relatório de validação — Ashen Testimony V1.5.54

## Escopo
Corrigido o caminho de notificação Realtime do estado global: inscrição e emissor agora compartilham o tópico `a-profecia-live-v2`; o evento é publicado após a confirmação da gravação global pelo Supabase. O polling existente foi preservado como fallback. Foi incluído um teste E2E configurável para homologação isolada com 15 sessões.

## Testes executados
- Sintaxe JavaScript: passou em 58 arquivos.
- Testes unitários: 138 passaram, 0 falharam.
- Regressão de sincronização: 42 verificações passaram.
- Auditoria de estabilidade: 23 verificações passaram.
- Testes da API de manutenção: passaram.
- Testes de caos de rede: 10 passaram, 0 falharam.
- Auditoria XSS: 21 ocorrências antigas na baseline, 0 novas.
- `scope-check`: pulado porque TypeScript não está instalado.

## Build e homologação
- `npm run build` não foi concluído: `vite` não está instalado neste ambiente.
- A instalação de dependências falhou com `EAI_AGAIN` ao resolver `registry.npmjs.org`.
- O teste E2E de 15 sessões foi criado, mas não executado: não há credenciais/projeto de homologação configurados.
- Não houve deploy nem teste de navegador real.

## Produção e dados
Nenhuma migração SQL foi executada e nenhuma escrita no Supabase de produção foi feita nesta revisão.

## Conclusão
A regressão local da sincronização passa e o ponto da notificação global foi corrigido no código. **A capacidade real para 15 usuários simultâneos continua não certificada** até a execução de `npm run test:e2e:staging-sync` em um projeto descartável, seguida de build e teste da versão compilada. Instruções: `COMO_EXECUTAR_E2E_HOMOLOGACAO.md`.
