# Relatório de validação — Ashen Testimony V1.5.55

## Mudança principal
O canal Broadcast global foi endurecido: todos os handlers são registrados antes do join do Supabase; os eventos são distribuídos por um dispatcher local compartilhado; callbacks com erro são isolados; e há tentativa de reconexão após falha de canal enquanto existirem assinantes.

## Testes executados
- Sintaxe JavaScript: passou em 58 arquivos.
- Testes unitários: **140 passaram, 0 falharam**.
- Regressão de sincronização: **43 verificações passaram**.
- Auditoria de estabilidade: 23 verificações passaram.
- Testes da API de manutenção: passaram.
- Testes de caos de rede: 10 passaram, 0 falharam.
- Auditoria XSS: 21 ocorrências anteriores conhecidas na baseline, 0 novas.
- `scope-check`: não executado; a dependência opcional TypeScript não está instalada.
- O teste de Realtime foi atualizado para congelar os bindings remotos no momento do `subscribe()`, simulando o contrato documentado de join. Também valida a reconexão após fechamento do canal e a entrega de eventos após reconectar.

## Build e teste real
- `npm run build`: **não validado**; `vite` não está instalado no ambiente.
- A tentativa anterior de instalar dependências foi bloqueada por erro de rede/DNS (`EAI_AGAIN` para `registry.npmjs.org`).
- O E2E com 15 sessões não foi executado, porque não há credenciais/projeto Supabase de homologação configurados.
- Nenhum teste de navegador real foi executado.

## Dados e produção
Nenhuma migration SQL foi executada. Nenhum dado de produção foi gravado, alterado ou removido. Nenhum deploy foi feito.

## Conclusão
Os testes locais passam e cobrem melhor o risco de callbacks Broadcast registrados tarde demais. **Ainda não é possível certificar que 15 jogadores simultâneos funcionam sem falhas.** Para isso, é necessário instalar dependências, executar o build, rodar `npm run test:e2e:staging-sync` em projeto Supabase isolado com 15 contas descartáveis e testar a compilação em navegador antes de qualquer deploy.
