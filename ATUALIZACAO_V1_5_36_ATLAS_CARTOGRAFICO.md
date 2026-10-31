# Ashen Testimony V1.5.36 — Atlas cartográfico redesenhado

## Conceito
- A tela do mapa foi redesenhada como um atlas gótico de campo: fundo carvão, acentos vinho e latão, linhas topográficas, grade cartográfica, vegetação, rosa dos ventos e anotações editoriais.
- O painel lateral agora funciona como registro de campo, com contexto do distrito, editor do Mestre e lista de locais anotados.
- O layout se adapta a desktop e celular e respeita `prefers-reduced-motion`.

## Separação do código
- Toda a renderização e interação do mapa continuam isoladas em `src/campaignMap.js`.
- A geração procedural foi refeita em `src/mapGenerator.js`: distritos por células de Voronoi recortadas por um contorno orgânico, vias curvas, anéis irregulares e quadras determinísticas.
- `src/main.js` não recebeu lógica de mapa e não foi alterado.
- `app.js` mantém somente os pontos de integração existentes para renderizar a aba e passar os callbacks já usados pelo jogo.

## Compatibilidade preservada
- Mantido o formato `state.campaignMap.regions`, os campos `cartography.roads`, `cartography.blocks`, `cartography.waterPath` e os marcadores `player.mapMarkers`.
- Mantidas as operações do Mestre para gerar uma carta e editar nome, descrição e cor de distrito.
- Mantidas as operações de jogador para adicionar, editar e remover seus marcadores.
- O cálculo da posição do clique usa a matriz de transformação SVG, corrigindo a colocação em telas com escala/aspect ratio diferentes.
- Os textos inseridos em SVG/HTML continuam escapados.

## Testes executados
- `node --check src/campaignMap.js` — aprovado.
- `node --check src/mapGenerator.js` — aprovado.
- `node scripts/check-syntax.mjs` — aprovado (43 arquivos).
- `node --test scripts/unit/*.test.mjs` — 99 testes passaram, incluindo os 3 testes novos do Atlas.
- `node --check src/campaignMap.js` e `node --check src/mapGenerator.js` — aprovados.
- `npm run build` não pôde ser executado: a dependência Vite não estava instalada e `npm install` excedeu o tempo limite neste ambiente sem dependências disponíveis.

## Limitações conhecidas
- Não foi possível executar uma inspeção visual em navegador real neste ambiente.
- A sincronização permanece no mecanismo já existente do projeto; não houve alteração no schema Supabase nem em políticas/RPCs.
- O mapa é cartografia fictícia para uso narrativo, não um mapa geográfico real ou medido.
