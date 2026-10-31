# Ashen Testimony V1.5.47 — Laboratório de carga modular

## Mudanças
- Movido o renderizador da aba **Teste de carga** para `src/loadTest.js`.
- Movida a simulação de convergência de Players e a execução do teste para o mesmo módulo isolado.
- As dependências do app (estado, sincronizador, leitor remoto e notificação) agora são passadas explicitamente ao módulo, reduzindo acoplamento com o `app.js`.
- O teste de servidor agora mede latência p50/p95/máxima e pico de requisições simultaneamente em andamento.
- Mantida a abordagem segura: a simulação usa estado artificial isolado; o teste opcional no Supabase é somente leitura e não grava fichas.
- A versão do aplicativo foi atualizada para V1.5.47.

## Limites
Este refactor não comprova capacidade para 30 usuários reais. São necessários testes independentes com sessões reais e monitoramento de latência/erros. A compilação de produção precisa ser validada com as dependências instaladas.
