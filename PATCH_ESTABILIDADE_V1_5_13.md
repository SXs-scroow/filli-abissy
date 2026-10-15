# Patch de estabilidade V1.5.13 — candidato

## Alterações desta revisão

- `src/players.js`: uma segunda leitura do roster que falha agora propaga o erro, em vez de devolver a primeira resposta vazia como se a ausência estivesse confirmada. Isso evita tratar uma falha de rede como confirmação de roster vazio.
- `scripts/chaos/network-chaos.test.mjs`: os testes de sincronização de Player passam a injetar falhas na RPC direcionada `a_profecia_get_players_by_ids`, usada pelo fluxo atual; o relógio lógico é reiniciado entre testes para reduzir contaminação de estado entre cenários.

## Estado de validação

- `node scripts/check-syntax.mjs`: passou.
- `npm run test:chaos`: ainda apresenta falhas em cenários de escrita, exclusão e Realtime. Esta revisão não deve ser considerada aprovada para release até essas falhas serem resolvidas e a suíte completa passar com a dependência real `@supabase/supabase-js`.
