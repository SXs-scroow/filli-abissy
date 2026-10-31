# Ashen Testimony V1.5.61 — Fechamento técnico

## Incluído

- Mantidas as melhorias da V1.5.60: gravação de fichas com concorrência limitada a quatro grupos independentes, ordem preservada dentro da mesma ficha e manutenção da fila pendente em falhas.
- Mantido o carregamento preguiçoso de imagens não críticas, sem substituir a prioridade de marca/símbolo.
- Mantidos os ajustes responsivos e de hierarquia visual da V1.5.60.
- Corrigido `scripts/scope-check.mjs`: encontra TypeScript instalado globalmente quando disponível e declara `__ASHEN_BUILD_ID__`, substituído pelo Vite, para não acusar um falso positivo.
- Adicionado TypeScript 5.8.3 como dependência de desenvolvimento para que `check:scope` não seja pulado em uma instalação normal.
- Versão da aplicação e do pacote atualizada para 1.5.61.

## Validação realizada neste ambiente

- Sintaxe: 64 arquivos JavaScript analisados com sucesso.
- Auditoria de estabilidade: 23 verificações aprovadas.
- Regressão de sincronização: 43 verificações aprovadas.
- Testes unitários: 154 aprovados, 0 falhas.
- Chaos/rede: 10 aprovados, 0 falhas.
- Backup e pontos dedicados: aprovado.
- Auditoria XSS: 21 interpolações conhecidas na baseline, 0 achados novos.
- Checagem de escopo com TypeScript 5.8.3: aprovada após corrigir o falso positivo de `__ASHEN_BUILD_ID__`.
- Simulações de convergência: testadas por suites automatizadas para 20, 50 e 100 clientes virtuais; são simulações locais, não conexões reais de navegador.

## Bloqueio restante

O build de produção e a inspeção visual de ponta a ponta não puderam ser concluídos neste ambiente. `npm install` ficou sem resposta por falha de resolução DNS (`EAI_AGAIN registry.npmjs.org`), e `node_modules/.bin/vite` não está disponível. Portanto, não declarar esta versão pronta para publicação em produção até executar `npm install`, `npm run build` e os testes visuais do build gerado em ambiente com acesso ao registry.

## Dados de produção

Nenhum comando de migração foi aplicado e nenhum registro do Supabase de produção foi alterado durante esta rodada.
