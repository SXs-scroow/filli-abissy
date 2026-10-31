# Ashen Testimony V1.5.37 — Editor de terreno e assets manuais

## O que mudou
- O gerador agora cria apenas o formato-base por padrão; não inclui estradas, água ou quadradinhos automaticamente.
- O Mestre pode ativar separadamente a geração de caminhos, rio/lago e quadradinhos de casas secundárias.
- Removidos o rio decorativo padrão, as trilhas fixas e o marco central automático.
- Adicionada importação de PNG, JPG e WebP (até 500 KB por arquivo) para posicionar assets no mapa.
- Assets importados são armazenados em `campaignMap.cartography.assets`, podem ser arrastados e removidos com duplo clique.
- Regenerar o terreno preserva os assets existentes e os marcadores dos jogadores.
- A implementação continua isolada em `src/campaignMap.js` e `src/mapGenerator.js`; `main.js` não foi alterado.

## Verificações
- `npm run check` — aprovado (44 arquivos JavaScript).
- `npm run test:unit` — 100 testes aprovados.
- `npm run stability:check` — 19 verificações aprovadas.
- `npm run test:sync` — 32 verificações aprovadas.
- `npm run audit:xss` — 0 novas ocorrências fora da baseline conhecida.
- `npm run build` — não executado com sucesso porque o ambiente não possui Vite instalado (`vite: not found`).

## Observações
- A visualização em navegador real ainda precisa ser testada.
- Assets são guardados como data URLs no estado da campanha. Para manter a sincronização leve, cada arquivo importado tem limite de 500 KB; prefira PNGs otimizados com transparência.
- Arraste o asset para ajustar a posição; dê duplo clique para removê-lo.
