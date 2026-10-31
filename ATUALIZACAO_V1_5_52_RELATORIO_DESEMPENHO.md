# Ashen Testimony V1.5.52 — relatório de desempenho

## O que mudou
- Classificação heurística das métricas locais em `clear`, `watch` ou `attention`.
- Sinais apresentados incluem carregamento acima de 4/8 segundos, atraso local acima de 100 ms, tarefas longas e heap reportado acima de 75% do limite exposto.
- Exportação do relatório de desempenho em JSON pelo laboratório do Mestre.
- O JSON exportado contém métricas técnicas locais do navegador; não inclui ficha, credenciais ou estado da campanha.

## Como testar
1. Abra o painel do Mestre e a Central de Testes.
2. Clique em **Medir desempenho local**.
3. Confira o nível e os sinais heurísticos.
4. Clique em **Exportar relatório JSON** e abra o arquivo para conferir as métricas.
5. Repita no celular e no computador, depois de abrir e navegar pelo site.

## Limites
Os limites são heurísticos para triagem, não metas universais nem prova de bom desempenho. Os resultados variam com dispositivo, rede, cache e suporte do navegador. A medição não testa o servidor nem a capacidade de usuários simultâneos. A exportação só funciona após uma medição bem-sucedida.
