# A Profecia — V1.4.2 Sessão e Sincronização

## Correção

- O Supabase pode retornar `SESSÃO INVÁLIDA` com acento/espaço e código `P0001`.
- A aplicação reconhecia apenas `SESSAO_INVALIDA`, então mantinha um token inválido e entrava em modo somente-leitura.
- A rotina de tratamento de autenticação agora normaliza acentos/espaços e limpa o token inválido, disparando o fluxo seguro de novo login.
- `authCheck()` também passa pelo mesmo tratamento.
- O diagnóstico de sessão usa a mesma normalização.

## Segurança

- Nenhum Player é apagado.
- Nenhum dado do Supabase é alterado por esta correção.
- A sessão local é preservada como dados locais; apenas o token inválido é removido.
