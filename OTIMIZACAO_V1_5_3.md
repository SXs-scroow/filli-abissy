# V1.5.3 — pontos no celular + relógio dos carimbos

## Problema
Em alguns celulares o Player não conseguia gastar todos os pontos (ou eles "voltavam"). Duas causas:

1. **Campo de pontos** (`<input type="number">` sem setas no celular) + um handler que REESCREVIA o valor a cada tecla.
   Tocar num campo com "2" e digitar "3" gerava "23", e o código "consertava" para outro número (o que sobrava).
   Teclados como Samsung/Gboard perdiam o cursor; vírgula/ponto deixavam o campo vazio sem aviso.
2. **Relógio do aparelho**: os carimbos (`_pointsAt`, `_syncUpdatedAt`, `_keyAt`) eram `Date.now()`. Celular com a hora
   atrasada gerava carimbo MENOR que o do servidor, perdia a disputa, e a fila de envio ainda removia a edição como se
   tivesse sido salva.

## O que mudou
- **Campos de pontos** (`app.js`: `pointField`, `normalizePointText`, `allowedPointValue`, `bindPointInputs`):
  campo de texto com teclado numérico, seleciona tudo ao tocar, botões − / +, "Restam N" ao vivo, campo vazio permitido
  enquanto digita (vira 0 ao sair), aviso quando bate no limite. As regras são funções puras com teste.
- **`src/stampClock.js`** (novo): relógio lógico híbrido. `nextStamp()` = maior entre a hora do aparelho e o maior carimbo
  já visto + 1. Uma edição feita DEPOIS de ver o servidor sempre vence, com a hora do aparelho certa ou errada.
  `players.js`, `playerStore.js` e `app.js` usam `nextStamp()` em vez de `Date.now()` para carimbos.
- **Fila de envio** (`playerStore.js`): se o servidor devolve a ficha SEM os pontos enviados, a edição NÃO é dada como
  salva; os carimbos são renovados e ela fica na fila para a próxima rodada.
- `scripts/xss-audit.mjs`: `pointField` entra na lista de escapadores (ele aplica `esc()` internamente).

## Testes
- `scripts/unit/point-inputs.test.mjs` (teclado do celular, limites, botões) e `scripts/unit/stamp-clock.test.mjs`
  (celular com hora atrasada). Suíte unit: 63/63.
- `npm run test:chaos` precisa de `npm install` (usa `@supabase/supabase-js`); rode `npm run release:check` na sua máquina.
