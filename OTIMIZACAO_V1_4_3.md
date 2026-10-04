# A Profecia — V1.4.3 — Recuperação de sessão e RPC de Players

## Correção
- O roster não chama `a_profecia_list_players` quando a aba não possui token.
- Um HTTP 400 do RPC é distinguido de sessão inválida.
- Se o servidor ainda reconhece a sessão, o roster faz uma única nova tentativa.
- Sessão inválida não entra em loop de requests nem tenta gravar dados.
- Nenhum Player ou dado do Supabase é apagado/modificado por esta correção.

## Banco
- Nenhuma migration ou alteração destrutiva foi aplicada.
- A RPC de listagem existente continua sendo usada.
