# V1.5.2 — lógica de Players em arquivo próprio

## O que mudou
- Novo arquivo **`src/players.js`**: tudo o que decide como a ficha de um Player é guardada, comparada e mesclada
  com a do servidor saiu do `app.js` (que tinha ~3.500 linhas / 458 KB) e foi para lá:
  carimbos por campo e de pontos (`keepNewerLocalPoints`, `preserveLocalSheetAgainstReset`), `markLocalPlayerChanges`,
  `mergePlayersRemote`, `applyPlayerRows`, `fetchPlayerRowsConfirmed`, `hydratePlayersDb`, `syncPlayersDbNow`,
  `queuePlayerDbSave`, `reconcilePlayersStability`, cache do roster confirmado, `mergeRollHistory`, `mergeSecretClues`.
- O comportamento é o mesmo: o código foi movido, não reescrito.

## Como o app.js conversa com o players.js
- `initPlayers({...})` é chamado no `app.js` ANTES de `load()` e entrega o que o arquivo precisa (estado atual,
  storage, `clone`, `normalize`...). Não há import circular.
- Os `let playerDbXxx` soltos viraram o objeto exportado **`ps`**:

| antes | agora |
|---|---|
| `playerDbReadOnly` | `ps.readOnly` |
| `playerDbHydrated` | `ps.hydrated` |
| `playerDbApplying` | `ps.applying` |
| `playerDbHydrating` / `playerDbHydratePromise` | `ps.hydrating` / `ps.hydratePromise` |
| `playerDbLastSyncAt` | `ps.lastSyncAt` |
| `playerDbSyncBusy` / `playerDbSyncPromise` | `ps.syncBusy` / `ps.syncPromise` |
| `playerDbTimer` / `playerDbUnsubscribe` | `ps.timer` / `ps.unsubscribe` |
| `playerSyncCircuitOpen` | `ps.circuitOpen` |
| `lastPlayersSnapshot` | `ps.lastSnapshot` |

## Testes
- Os testes que extraíam funções do `app.js` agora leem `app.js` + `src/players.js` (`readAppSources` em
  `scripts/chaos/extract-app.mjs`). `scope-check` também confere o `players.js`.

## Próximo passo possível
- As TELAS de Players (`playersAdmin`, `openPlayerView`, `registerPlayer`, lixeira, dossiê) ainda estão no `app.js`.
  Elas dependem de ~70 funções de interface; separar é possível, mas deve ser feito por partes (ex.: primeiro lixeira
  e histórico, depois admin) e testando no navegador a cada etapa.
