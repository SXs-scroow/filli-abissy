# A Profecia V29 — revisão profunda

Esta versão parte da V28 existente e preserva a arquitetura de Vite + JavaScript do projeto para reduzir risco de regressão.

## Correções e refinamentos
- Removido conflito de inicialização do assistente antigo; novo Anjo global foi incorporado.
- Anjo dourado/preto carregado de `public/anjo-profecia.jpg`.
- Home reorganizada para colocar o retrato real do Player no centro visual.
- Retrato do Player e imagem da Alma são redimensionados antes de serem persistidos.
- Símbolos de atributos e perícias agora aceitam texto/ícone e upload de imagem pelo Mestre.
- Condições e magias continuam com upload de imagem.
- Seleção de classe continua única e confirmada.
- Seleção de magia inicial continua única e confirmada.
- Condições temporárias reiniciam a duração quando são reaplicadas, em vez de reaproveitar contagem antiga.
- Treino de perícias na Home é calculado a partir dos valores efetivos e sem duplicação visual.
- Navegação e sistemas existentes foram preservados.

## Verificações executadas
- `node --check app.js` → OK.
- Busca de funções duplicadas → nenhuma encontrada.
- Verificação de referências principais: login, Players, classes, magias, condições, símbolos, música global, sons, fundos e Anjo → OK.
- Verificação de assets da nova versão → OK.

## Observação
O ambiente desta execução não conseguiu concluir `npm install` a tempo para executar o `vite build`. O código JavaScript foi validado com `node --check` e a estrutura de Vite/arquivos foi conferida estaticamente.
