# V1.4.9 — Sessão e fila de sincronização isoladas

## Correções

- A fila durável de Players agora é separada por sessão/token. Uma alteração pendente de uma conta não pode ser enviada usando o token de outra conta no mesmo navegador.
- A liderança entre abas também passou a ser isolada por sessão.
- O boot não continua carregando roster/global depois que `authCheck()` confirma uma sessão inválida. Isso evita o ciclo `SESSAO_INVALIDA -> somente leitura -> novas chamadas RPC`.
- O token continua fora do armazenamento da fila; somente um fingerprint é usado como namespace local.

## Segurança

Nenhum Player, migration ou dado do Supabase é apagado por esta versão.
