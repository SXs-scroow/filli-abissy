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

## V67 — Players sumindo, "Personagem não encontrado", ficha zerada

**Sintoma relatado:** de vez em quando a ficha do Player sumia da tela, aparecia
"Personagem não encontrado" e, quando voltava, a ficha estava zerada.

**Causa raiz:** a sincronização com o Supabase tratava qualquer leitura vazia (ou
que não trazia a própria linha do Player) como se fosse uma exclusão confirmada
pelo Mestre — mesmo quando era só uma falha transitória de rede, uma aba em
segundo plano no celular voltando, ou uma corrida entre o broadcast em tempo
real e a leitura seguinte. Isso acontecia em três lugares:

1. `hydratePlayersDb()`: uma resposta vazia zerava `state.players` e também
   `state.session.playerSnapshot` (o último fallback usado para desenhar a
   ficha), na hora, sem nenhuma confirmação.
2. `syncPlayersDbNow()`: se a própria linha do Player não aparecesse numa
   leitura, ela era apagada do estado local, mesmo sem nenhum sinal explícito
   de exclusão vindo do servidor.
3. `subscribePlayers()` (tempo real): como a leitura de um Player só pode ver a
   própria linha (regra de segurança do banco), qualquer evento sobre OUTRO
   Player automaticamente "não aparecia" na releitura e virava uma exclusão
   fabricada na hora.

**Correção:** nenhuma dessas três rotinas apaga mais a própria ficha do Player
(nem o snapshot de fallback) a partir de uma única leitura ausente. Antes de
considerar algo "ausente", o código agora faz uma segunda leitura de
confirmação (`fetchPlayerRowsConfirmed`, e o mesmo padrão em
`subscribePlayers`). Mesmo confirmada, uma ausência nunca mais apaga a PRÓPRIA
ficha do Player que está com a página aberta — só some da lista local um Player
diferente, ou quando o Mestre confirma a exclusão pelo fluxo já existente
(`confirmPlayerDeletion`).

Veja `scripts/player-sync-regression.mjs` para as checagens automáticas que
travam esse comportamento.
