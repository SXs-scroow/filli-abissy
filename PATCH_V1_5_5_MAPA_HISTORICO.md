# Ashen Testimony V1.5.5 — gerador de formato e histórico

## Mapa
- Adiciona no painel do Mestre um gerador procedural de contorno fictício baseado em um texto de referência.
- A mesma referência gera o mesmo formato; outra referência tende a gerar outro contorno.
- Não consulta nem copia limites geográficos reais, ruas ou dados cartográficos. A referência funciona como semente criativa.
- Antes de substituir o formato atual, pede confirmação. Mantém nomes, cores, descrições das regiões e marcadores dos Players.
- As alterações só são consideradas sincronizadas se `saveGlobal` retornar sem erro.

## Histórico — importante
A interface já chama as RPCs `a_profecia_player_history_list` e `a_profecia_player_history_get`. A migração que cria essas funções e a tabela está em `supabase/migrations/20261005140000_player_history_and_field_merge.sql`.

Se o histórico não funciona, confirme no Supabase se essa migração foi aplicada ao projeto conectado ao site. Se não foi, aplique o arquivo inteiro pelo fluxo de migrações usado no projeto, após revisar o SQL e fazer backup. Não execute apenas partes isoladas e não apague a tabela de Players.

Se a migração já estiver aplicada, abra o Histórico e anote a mensagem de erro exata exibida. Ela ajuda a distinguir sessão/token inválido, RPC ausente/permissão e ausência de versões salvas. Não é possível corrigir o banco remoto só alterando o ZIP; essa parte precisa ser verificada no Supabase.

## Verificações locais
- `npm run check`: aprovado (30 arquivos JavaScript).
- `npm run test:sync`: aprovado (27 verificações).
- `npm run test:unit`: aprovado (63 testes).
- `npm run build`: não executado nesta sessão porque as dependências locais do Vite não estavam instaladas (`vite: not found`). Rode `npm ci` e depois `npm run build` no ambiente de desenvolvimento.
