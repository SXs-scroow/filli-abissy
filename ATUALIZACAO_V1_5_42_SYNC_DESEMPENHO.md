# Ashen Testimony V1.5.42 — sincronização e desempenho

## Correções
- Canal Realtime dos Players alinhado ao tópico fixo publicado pelo trigger SQL (`a-profecia-players-events`).
- Leituras direcionadas de fichas processadas em lotes de até 50 IDs, sem truncar elencos maiores.
- Eventos Realtime mantidos em fila após erros de rede e repetidos com backoff exponencial limitado.
- Exclusão física só sinalizada após uma segunda leitura bem-sucedida; uma falha de leitura não vira exclusão.
- Eventos recebidos durante uma leitura não são apagados junto com um evento anterior do mesmo Player.
- Verificação do token entre lotes para evitar continuar chamadas quando a sessão muda.
- Versão de cache atualizada para evitar que o navegador continue usando o código antigo.

## Verificações executadas
- Sintaxe JavaScript: 44 arquivos aprovados.
- Auditoria de sincronização: 35 verificações aprovadas.
- Auditoria de estabilidade: 22 verificações aprovadas.
- Auditoria XSS: sem novas ocorrências.
- Testes unitários: 102 aprovados.
- Testes de caos de rede: 10 aprovados.
- Testes do agente de manutenção: aprovados.

## Limitações conhecidas
A compilação Vite de produção não foi concluída nesta execução: as dependências não estavam instaladas e a tentativa de instalação expirou. Não foi feito teste contra o projeto Supabase real nem teste de navegador com vários aparelhos reais. Portanto, esta versão não deve ser descrita como perfeita até passar nessas validações integradas.
