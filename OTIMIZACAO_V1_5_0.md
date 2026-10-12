# V1.5.0 — Fila de sincronização isolada por sessão

## Objetivo
Evitar que uma troca de conta/token no mesmo navegador reutilize itens de sincronização em memória ou grave uma falha pendente na fila da sessão errada.

## Alterações
- A fila em memória agora é limpa sempre que o escopo derivado da sessão muda.
- Cada execução de flush captura o escopo e o token inicial.
- Antes e depois de cada chamada de gravação, a execução verifica se a sessão continua sendo a mesma.
- Se o token mudar durante uma chamada bem-sucedida ou com erro, o flush é interrompido sem transferir o item para a fila da outra sessão.
- Erros de autenticação interrompem a tentativa sem martelar o RPC.
- Nenhuma migration ou alteração destrutiva no Supabase.

## Validação
- Sintaxe JS: 24 arquivos OK.
- Stability Audit: 17/17.
- Player Sync Regression: 27/27.
- Unit tests: 40/40.
- Maintenance AI: PASS.
- XSS audit: 0 novas ocorrências.
- Chaos tests e build Vite não foram concluídos: a instalação de dependências expirou e `@supabase/supabase-js` não estava disponível no ambiente.

## Teste manual obrigatório
Trocar de conta sem recarregar a página com uma gravação pendente; confirmar que a nova sessão não envia alterações da anterior. Depois testar salvar Player, F5 e sincronização com outro dispositivo.
