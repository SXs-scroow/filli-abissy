# Ashen Testimony — V1.5.20
## Teste de escala e resistência da sincronização

### Alterações
- O laboratório local testa rosters de 20, 50 e 100 aparelhos virtuais usando `simulateRosterConvergence` e o `applyPlayerRows` real.
- Cada escala executa três rodadas com eventos repetidos e fora de ordem, pistas, exclusão confirmada e relógio local adiantado.
- O teste confere divergências de Vida, convergência, exclusões e preservação do estado real do Mestre.
- O teste de rede continua limitado a até 20 leituras concorrentes direcionadas ao Supabase, para não gerar uma rajada desnecessária de tráfego. O relatório separa simulação local de carga real do servidor.
- Uma falha local ou falha de rede não pausa a sincronização automática das fichas reais.

### Validação executada neste ambiente
- `npm run check`: aprovado (34 arquivos JavaScript).
- `npm run test:sync`: aprovado (32 verificações de regressão).
- `npm run test:unit`: aprovado (68 testes, incluindo escala 20/50/100).
- `npm run stability:check`: aprovado (17 verificações).
- `npm run audit:xss`: aprovado em relação à baseline (21 interpolações antigas conhecidas, zero novas).
- Teste de escala isolado: 20, 50 e 100 aparelhos virtuais convergiram sem divergência e sem alterar o estado real.
- `npm run check:scope`: ignorado pelo script porque TypeScript não está instalado.
- Build de produção e `npm run test:chaos`: não confirmados porque as dependências npm não puderam ser instaladas neste ambiente.

### Limite importante
O teste local verifica a lógica do cliente e a convergência simulada; ele não comprova que o projeto Supabase/hosting suporta 100 usuários reais conectados ao mesmo tempo. Para isso, é necessário executar um teste de carga contra um ambiente de staging e observar limites, latência, erros e consumo do serviço.
