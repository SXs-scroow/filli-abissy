# Ashen Testimony V1.5.10 — auditoria XSS sem travamento

## Correções

- Corrigido o caso em que `indexOf('*/')` retornava `-1` e o auditor voltava para o início do arquivo indefinidamente.
- Otimizado o cálculo dos números de linha usando uma tabela de inícios de linha e busca binária.
- Ajustadas interpolações de valores numéricos e atributos HTML na ficha/mochila para usar conversão numérica ou `esc()`.
- Adicionado teste de regressão que executa `scripts/xss-audit.mjs --check` no `app.js` real, com limite de 5 segundos e exigência de zero findings novos.
- A baseline existente foi preservada; não foi atualizada para silenciar alertas.

## Validação executada neste ambiente

- `node scripts/check-syntax.mjs`: passou (34 arquivos JavaScript).
- `node scripts/stability-audit.mjs`: passou (17 verificações).
- `node scripts/player-sync-regression.mjs`: passou (27 verificações).
- `node scripts/xss-audit.mjs --check`: terminou em aproximadamente 0,07 s; 29 findings conhecidos e 0 novos.
- `node --test scripts/unit/*.test.mjs`: 66 testes passaram, 0 falhas.
- `node scripts/test-maintenance-ai.mjs`: passou.
- `node scripts/scope-check.mjs`: terminou com aviso e pulou a verificação TypeScript porque TypeScript não estava instalado.

## Validações pendentes por falta de dependências locais

O ZIP não inclui `node_modules`. O ambiente de edição não conseguiu acessar o registro do npm para instalar as dependências. Por isso, `scripts/chaos/network-chaos.test.mjs` não pôde ser validado (falta `@supabase/supabase-js`) e o build de Vite não foi executado nesta revisão. Depois de extrair o projeto, instalar as dependências e rodar `npm run release:check`, confirme especialmente essas duas etapas.

> A auditoria XSS atual é um analisador estático próprio, não um parser completo da linguagem JavaScript. O teste de regressão confirma que ela termina e respeita a baseline atual; isso não equivale a uma garantia formal de ausência de XSS.
