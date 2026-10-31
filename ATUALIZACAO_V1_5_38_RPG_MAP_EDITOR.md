# Ashen Testimony V1.5.38 — Integração de fluxo com RPG Map Editor

## Implementado
- Botão no painel cartográfico para abrir o gerador oficial do RPG Map Editor em nova aba.
- Fluxo de importação de mapas exportados como PNG, JPG ou WebP, com limite de 3 MB por imagem.
- A imagem importada aparece como base visual no Atlas; os assets colocados manualmente e os marcadores dos jogadores continuam em camadas acima.
- Botão para remover a base importada sem apagar assets posicionados.
- Estado da base importada é guardado em `campaignMap.cartography.importedMap` e passa pelo fluxo de salvamento/sincronização já existente.
- Não altera `main.js` nem integra código de terceiros dentro da aplicação.

## Limitações conhecidas
- O RPG Map Editor não anuncia API pública. Por isso esta é uma integração por abertura externa e importação de imagem, não uma integração embutida ou sincronização bidirecional.
- O PNG é uma imagem achatada: camadas/objetos editáveis do projeto original não são convertidos para objetos do Ashen Testimony.
- A imagem importada é limitada a 3 MB para reduzir o risco de sobrecarregar o estado sincronizado. O tamanho em pixels pode ser ajustado visualmente ao retângulo do Atlas.
- O editor oficial é desktop-first; teste no computador recomendado.

## Validação
- `npm run check`: passou; sintaxe de 44 arquivos JavaScript validada.
- Não foi executada compilação Vite nem validação visual no navegador neste ambiente.
