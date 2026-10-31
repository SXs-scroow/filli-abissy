# Ashen Testimony V1.5.61 — Relatório de entrega

## Entregue

Projeto-fonte completo com a camada visual V1.5.60 preservada, as otimizações de desempenho/sincronização já presentes no código, ajuste da checagem de escopo estático e identificação de release V1.5.61.

### Mudanças nesta finalização

- Atualização da versão de pacote e da identificação exibida pela aplicação para `1.5.61`.
- `scripts/scope-check.mjs` agora descobre TypeScript no diretório global do npm quando existe e reconhece `__ASHEN_BUILD_ID__` como definição injetada pelo Vite, evitando falso positivo.
- `typescript@5.8.3` incluído em `devDependencies`, pois a sequência de validação chama `check:scope`.
- `upsertPlayers` continua limitando a quatro gravações concorrentes de fichas independentes e mantendo ordem para alterações do mesmo jogador. Falha mantém os itens na fila pendente.
- Imagens não essenciais continuam com carregamento tardio; CSS mantém adaptações mobile/tablet e redução de movimento.

## Resultado dos testes

| Verificação | Resultado |
|---|---|
| Sintaxe JavaScript | 64 arquivos — aprovado |
| Escopo estático TypeScript | aprovado |
| Auditoria de estabilidade | 23 verificações aprovadas |
| Regressão de sincronização | 43 verificações aprovadas |
| Backup e pontos dedicados | aprovado |
| Auditoria XSS | 0 achados novos em relação à baseline |
| Testes unitários | 154 aprovados, 0 falhas |
| Teste de manutenção/IA | aprovado |
| Testes de caos de rede | 10 aprovados, 0 falhas |
| `npm run build` | **não executado com sucesso** — `vite: not found` |

O `npm install --no-audit --no-fund` foi tentado, mas o ambiente não conseguiu acessar o registry npm (`EAI_AGAIN registry.npmjs.org`; a tentativa excedeu o tempo limite). Também não foi possível acessar o registry diretamente por HTTPS. Isso impede a compilação de produção e a inspeção visual automatizada do bundle neste ambiente.

## Teste Realtime anterior

A rodada anterior mediu 15 clientes independentes no staging do Supabase: autenticação, conexões Realtime, gravações, leituras de confirmação, fan-out dos eventos e reconexão passaram nos testes funcionais. Essa rodada não foi repetida na V1.5.61 porque esta finalização só altera a verificação estática e a identificação de versão, não o caminho de sincronização. A medição anterior não equivale a um teste visual de 15 navegadores nem a uma garantia de latência em todas as redes.

## Produção e dados

- Nenhuma migração foi aplicada nesta rodada.
- Nenhum registro do Supabase de produção foi alterado.
- Nenhum deploy de produção foi feito.

## Para liberar em produção

Em ambiente com acesso ao registry npm:

```bash
npm install
npm run release:check
```

A publicação deve ocorrer apenas se o comando terminar com sucesso — incluindo `vite build` — seguida de inspeção no preview de Vercel em celular e desktop e teste de ponta a ponta das áreas principais. Este pacote é a versão-fonte finalizada para essa validação; não deve ser descrito como um build de produção já validado.
