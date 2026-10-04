# A Profecia — V1.4.1 Correção de Inicialização

## Correção crítica

Corrigido um erro de inicialização em `src/playerStore.js`: `startPlayerSyncInfrastructure()` estava sendo chamado antes da inicialização da constante `localQueue`. Isso causava:

`Uncaught ReferenceError: Cannot access 'localQueue' before initialization`

Como consequência, a inicialização do Player Store era interrompida e a interface podia ficar vazia.

A inicialização agora ocorre somente depois que o estado da fila local foi criado.

## Validação

- Sintaxe JavaScript: OK (22 arquivos)
- Player sync regression: 27/27 OK
- Testes unitários: 32/32 OK
- Stability audit: 17/17 OK
- Build Vite: executar no ambiente de desenvolvimento antes do deploy
