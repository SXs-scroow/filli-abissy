# V1.4.4 — Recuperação de sessão rejeitada

- `a_profecia_whoami` retorna `null` quando o token expirou/revogado, sem gerar erro RPC.
- O cliente agora trata `null` como `SESSAO_INVALIDA` e dispara o mesmo fluxo de expiração usado pelos demais RPCs.
- Isso impede que a aplicação fique presa em modo somente-leitura com uma sessão morta.
- Nenhum Player ou dado do Supabase é apagado/modificado por essa correção.
