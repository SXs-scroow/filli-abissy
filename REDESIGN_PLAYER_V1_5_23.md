# Ashen Testimony — Redesign gótico da área dos Players (V1.5.23)

## Objetivo desta etapa
Aplicar a primeira camada do redesign à tela inicial e à ficha dos Players, com predominância de preto, vinho e vermelho-sangue e linguagem visual de dossiê gótico.

## Alterações desta entrega
- Nova camada visual delimitada por seletores de CSS para interface não-Mestre.
- Molduras mais rígidas e inspiradas em arquivos/catedrais, painel de personagem em vermelho-vinho e tratamento de retrato como documento.
- Reestilização de vida, sanidade, atributos, perícias, dados, condições, pontos e pertences.
- Primeira rodada de revisão de textos visíveis, sem alterar IDs dos campos, atributos dos personagens ou ações dos botões.
- Ajustes responsivos para saguão e ficha em telas pequenas.
- Respeito à preferência do sistema por movimento reduzido.

## Limites e proteção
- Não foram alterados os módulos de login/autenticação, `src/globalSync.js`, `src/syncCoordinator.js`, `src/playerStore.js` nem as migrações do Supabase.
- Não foram alterados formatos, chaves ou identificadores de dados dos personagens.
- Não foram reescritas as funções de salvar, sincronizar, distribuir pontos, rolar dados ou gerenciar pertences.
- As mudanças em `app.js` nesta etapa são apenas textos do HTML renderizado para o usuário.

## Verificações
Registrar os resultados efetivamente obtidos antes de distribuir este ZIP. Testes automatizados não substituem a conferência no navegador, o teste em celular e a verificação de sincronização entre dois dispositivos.

## Resultados desta verificação local
- `node scripts/check-syntax.mjs`: passou — 36 arquivos JavaScript.
- `node --test scripts/unit/*.test.mjs`: passou — 77/77 testes.
- `node scripts/player-sync-regression.mjs`: passou — 32 verificações.
- `node scripts/stability-audit.mjs`: passou — 19 verificações.
- `node scripts/xss-audit.mjs --check`: 21 ocorrências já conhecidas, 0 novas.
- Parser CSS (`tinycss2`): 0 erros de sintaxe de nível superior.
- Confirmado por comparação com a V1.5.22: `src/globalSync.js`, `src/syncCoordinator.js`, `src/playerStore.js`, `src/players.js`, `src/supabaseConfig.js` e a pasta `supabase/` não foram alterados.
- `npm run build`: não concluiu porque o diretório de trabalho não possui dependências instaladas (`vite: not found`). Não foi possível fazer validação visual real em navegador nesta sessão. O primeiro teste de uso deve ser feito localmente depois de `npm install` e `npm run dev`.
