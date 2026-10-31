# Ashen Testimony V1.5.53 — meta de 15 pessoas simultâneas

## Alterações
- Laboratório de capacidade passa a usar 15 clientes virtuais como meta mínima.
- Simulação de convergência escala em 15, 20, 30, 50 e 100 clientes virtuais.
- Sonda autenticada dispara até 15 leituras concorrentes, sem gravações em fichas reais.
- Relatório diferencia simulação local e sonda somente de leitura de uma validação ponta a ponta.
- Resultado de uma sonda somente de leitura nunca é rotulado como capacidade real aprovada.
- Preservados os módulos e funcionalidades existentes; nenhuma migração ou alteração de banco foi executada.

## Limitações importantes
Esta versão melhora o laboratório e a honestidade do diagnóstico, mas não prova sozinha que 15 usuários reais podem editar simultaneamente. Para isso, ainda é necessário um teste E2E em homologação com dados descartáveis, múltiplas sessões autenticadas, gravações, confirmação por Realtime e medição de latência/erros.

## Validação local
- `node scripts/check-syntax.mjs`
- `node --test scripts/unit/*.test.mjs`
- `node scripts/player-sync-regression.mjs`
- `node scripts/stability-audit.mjs`
- `node scripts/test-maintenance-ai.mjs`
- `node --test scripts/chaos/network-chaos.test.mjs`
- `node scripts/xss-audit.mjs --check`

O build de produção não foi confirmado: a instalação de dependências excedeu o tempo disponível. Não foi feito deploy e não foram feitas escritas no Supabase de produção.
