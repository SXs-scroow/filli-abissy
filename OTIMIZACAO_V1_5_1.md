# V1.5.1 — Correção do reset de ficha / pontos

## Problema
A proteção anti-reset (`preserveLocalSheetAgainstReset`) tratava `attrs`/`skills` zerados como "vazios" e
restaurava os pontos do aparelho mesmo quando o servidor tinha um carimbo de pontos (`_pointsAt`) MAIS NOVO.
Resultado: o Mestre zerar/reduzir pontos de um Player era desfeito e reenviado ao servidor.

## Correção
- `attrs`/`skills` só são preservados pela proteção anti-reset se o remoto NÃO tiver `_pointsAt` mais novo.
  (Pontos locais mais novos continuam protegidos por `keepNewerLocalPoints`.)
- Teste novo em `scripts/unit/points-protect.test.mjs`.
- Versão visível: V1.5.1; cache bust do `main.js` → `?v=1501`.

## Validação
Sintaxe, scope-check, stability, sync, XSS, unit e maintenance-ai passam. Chaos e build Vite não puderam rodar
no ambiente (npm bloqueado); rode `npm install && npm run release:check` localmente.
