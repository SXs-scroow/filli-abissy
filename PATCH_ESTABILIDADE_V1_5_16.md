# Patch de estabilidade — V1.5.16

## Correções

- `scripts/chaos/network-chaos.test.mjs` (teste de Realtime): o passo "DELETE físico" rodava depois da exclusão do `p1`, ou seja, com o token `tok-p1` já revogado. Por contrato (migração `20261013000000` e servidor simulado), um token revogado só lê a tombstone da PRÓPRIA ficha e recebe `SESSAO_INVALIDA` para qualquer outro id; o app se comportou corretamente e o teste é que estava mal sequenciado. O DELETE físico agora roda com a sessão ainda válida, e a exclusão explícita vem depois.
- `src/playerStore.js` + `scripts/chaos/network-chaos.test.mjs` (item 11, processo pendurado): o `setInterval` do leader lease (`startLeaderLease`) é criado no carregamento do módulo e nunca era parado, mantendo o processo Node vivo depois do último teste. O retorno de `startPlayerSyncInfrastructure()` agora é guardado e exposto como `stopPlayerSyncInfrastructure()`, chamado no `after` do teste. Comportamento no navegador: inalterado.

## Verificações executadas (Node v22.22.2)

- `check`, `check:scope`, `stability:check`, `test:sync`, `audit:xss`, `test:maintenance-ai`: exit 0.
- `test:unit`: 66/66.
- `test:chaos`: 10/10, termina em ~3 s com exit 0; repetido 5 vezes sem flutuação.

## Limitações desta validação (leia antes de liberar)

- O ambiente não tinha rede, então `npm install` não rodou. Os testes de caos foram executados com um SHIM LOCAL TEMPORÁRIO de `@supabase/supabase-js` (só `rpc` via fetch com o mesmo formato de erro do postgrest-js, e `channel` simulado). Ele NÃO faz parte deste pacote. Rode `npm install && npm run release:check` com o supabase-js real.
- `npm run build` (Vite) NÃO foi executado.
- A migração `20261013000000_fix_targeted_player_realtime.sql` continua precisando ser aplicada no Supabase remoto.
- Os testes de caos dos itens 1–5 da lista (envio cortado, resposta perdida, exclusão pelo Mestre, edição pendente + exclusão, leitura cortada) já passavam nesta versão com o shim; não houve alteração de lógica em `players.js`/`playerStore.js` para eles.
