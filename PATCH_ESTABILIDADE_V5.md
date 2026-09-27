# A Profecia — Patch de Estabilidade V5

Base preservada: `A_Profecia_V1_1_2_ESTABILIDADE_V4.zip`.

## Objetivo
Corrigir a reconciliação do roster de Players sem alterar as funcionalidades existentes do projeto.

## Alterações
- Exclusões confirmadas pelo servidor permanecem terminais.
- Tombstones explícitos do Mestre são reenviados usando a RPC dedicada de exclusão.
- Uma ficha ausente de uma leitura completa do servidor não cria mais automaticamente uma tombstone.
- Uma ficha com tombstone local nunca volta a ser gravada como Player ativo.
- O Realtime continua sendo apenas um acelerador; a reconciliação continua funcionando após F5/reconexão.
- Nenhuma alteração foi feita em TV, Spotify, biblioteca, magias, condições, terror, combate ou demais módulos fora do fluxo de Players.

## Validação
- `node --check app.js` — OK
- `node --check src/playerStore.js` — OK
- `npm run check` — OK (7 arquivos JavaScript)
- `npm run stability:check` — OK (10 verificações)

O build de produção deve ser executado no ambiente do projeto com `npm run build`.
