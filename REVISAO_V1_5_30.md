# Revisão técnica — Ashen Testimony V1.5.30

## Achado corrigido
- `app.js`: `globalPollTimer` era usado no agendamento do polling global, mas não tinha declaração no escopo global. Isso causava `ReferenceError: globalPollTimer is not defined` no boot. A variável agora é declarada junto dos timers globais existentes.

## Verificações executadas após a correção
- `node scripts/check-syntax.mjs`: passou (41 arquivos JavaScript).
- `node --test scripts/unit/*.test.mjs`: 93/93 passaram.
- `node scripts/player-sync-regression.mjs`: 32 verificações passaram.
- `node scripts/stability-audit.mjs`: 19 verificações passaram.
- `node scripts/xss-audit.mjs --check`: 0 ocorrências novas (21 ocorrências conhecidas na baseline).
- `node scripts/test-maintenance-ai.mjs`: passou.
- `node --test scripts/chaos/network-chaos.test.mjs`: 10/10 passaram. A linha `terminated` impressa durante um teste é uma falha de rede injetada intencionalmente pelo teste de caos.

## Limitações
- `npm run build` não executou: `vite: not found`.
- `npm install --no-audit --no-fund` excedeu o tempo limite deste ambiente, então não foi possível concluir a instalação e repetir o build.
- Não foi feito teste visual real no navegador nesta revisão.
- A tela de terminal existente ainda não implementa cadastro persistente de múltiplos áudios por puzzle; isso não foi alterado nesta correção para manter o escopo seguro.
