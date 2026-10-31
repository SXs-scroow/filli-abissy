# Reconstrução progressiva — Ashen Testimony V1.5.47

## Objetivo da estratégia

O projeto tem uma aplicação legada grande (`app.js`). Para reduzir risco de regressões em campanha ativa, a reconstrução está sendo feita em partes testáveis, retirando responsabilidades para módulos dedicados antes de reescrever fluxos centrais. Esta versão não afirma que o site inteiro foi reescrito.

## Módulos já separados

- `src/players.js`: reconciliação, sincronização e proteção do roster de Players.
- `src/playerStore.js`: acesso específico às fichas no Supabase.
- `src/globalSync.js`: autenticação, estado global, arquivos, RPCs e canais em tempo real.
- `src/syncCoordinator.js`: fila de snapshots globais, retries e persistência da fila.
- `src/persistence/browserStorage.js` e `src/persistence/playerQueue.js`: helpers de persistência local.
- `src/campaignMap.js` e `src/mapGenerator.js`: mapa de campanha e terreno-base.
- `src/terminalKit.js`: componentes e lógica do terminal imersivo.
- `src/loadTest.js` (esta versão): laboratório de carga do Mestre, isolado do fluxo normal de fichas.

## Mudanças da V1.5.47

- O renderizador e a execução do laboratório de carga foram movidos para `src/loadTest.js`; `app.js` injeta dependências explicitamente.
- A simulação usa o código real `applyPlayerRows`, mas troca o roster por cópias artificiais durante o teste e restaura players, tombstones e snapshot em `finally`.
- O teste no servidor executa até 30 leituras concorrentes autenticadas, sem operações de escrita ou exclusão.
- O resultado registra sucesso/falha, p50, p95, latência máxima e pico de pedidos simultâneos.
- Os testes automatizados cobrem o estado preservado, falha da simulação, 30/50/100 aparelhos virtuais e a classificação PARCIAL quando não há serviço remoto disponível.

## Próximas etapas seguras

1. Validar a compilação de produção com dependências instaladas.
2. Medir em ambiente de teste isolado com sessões separadas para avaliar autenticação, Realtime, gravações e limites de backend.
3. Continuar separando responsabilidades do `app.js` por domínio, preservando os testes de regressão em cada extração.
4. Fazer testes manuais em navegador de computador e celular, em especial reconexão, recarga, login, fichas abertas simultaneamente e cache entre deploys.

## Limitações verificadas nesta sessão

- Os testes automatizados passaram; eles não equivalem a um teste com 30 pessoas reais.
- A instalação de dependências não concluiu no ambiente, então o build Vite de produção não pôde ser confirmado.
- Nenhum deploy foi realizado.
