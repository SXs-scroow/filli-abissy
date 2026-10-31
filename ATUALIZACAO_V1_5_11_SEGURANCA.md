# Ashen Testimony V1.5.11 — hardening incremental

## Mudanças
- Escapado com `esc()` o identificador de condição usado em atributos HTML.
- Escapado com `esc()` o identificador de condição usado pelo upload de imagem.
- Escapados os tipos de barra/recurso em atributos HTML.
- Escapado o valor de elemento do dossiê.
- IDs do banco de itens são renderizados como números nos atributos de ação.
- O ID inicial do item passa por escape no atributo `value`.
- Categorias e raridades do banco de itens passam por escape HTML.
- Quantidade máxima do item é convertida para número antes de renderizar.
- Auditoria XSS não foi silenciada e a baseline não foi atualizada.

## Verificações executadas neste ambiente
- `node scripts/check-syntax.mjs`: passou (34 arquivos JavaScript).
- `node scripts/xss-audit.mjs --check`: passou, 21 interpolações conhecidas, 0 novas.
- `node scripts/player-sync-regression.mjs`: 27 checks passaram.
- `node scripts/stability-audit.mjs`: 17 checks passaram.
- `node --test scripts/unit/*.test.mjs`: 66 passaram, 0 falharam.

## Limitação importante
A auditoria estática ainda reporta interpolações conhecidas. Algumas são valores numéricos limitados, strings constantes ou markup construído por funções auxiliares; outras devem ser revisadas com análise de contexto. `0 novas` significa apenas que não apareceram assinaturas fora da baseline — não significa ausência total de XSS. Não alterar a baseline sem revisão manual. Build e teste de caos não foram validados nesta execução.
