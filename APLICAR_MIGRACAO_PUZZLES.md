# Ashen Testimony V1.5.26 — habilitar puzzles no Supabase

Os erros `404` em `a_profecia_session_puzzles_list` e `a_profecia_session_master_notes_get` significam que a API REST do Supabase não encontrou essas funções no banco. O código do site não consegue criar essas funções na nuvem sozinho.

## Instalar as funções e tabelas de puzzles

1. Abra o **Dashboard do Supabase** do projeto usado pelo site.
2. Entre em **SQL Editor** e crie uma consulta nova.
3. Abra este arquivo do pacote: `supabase/migrations/20261014120000_session_puzzles.sql`.
4. Copie o arquivo inteiro para o SQL Editor e execute-o uma única vez.
5. Confira se o editor terminou sem erro e recarregue o Ashen Testimony com `Ctrl + Shift + R`.

A migração cria apenas as tabelas de puzzles/tentativas e as RPCs privadas do recurso. Ela não apaga nem modifica fichas, contas ou a tabela global da campanha. O arquivo também solicita a atualização do cache de esquema do PostgREST.

## Confirmar que as RPCs foram registradas

Depois da migração, execute esta consulta no SQL Editor:

```sql
select
  to_regprocedure('public.a_profecia_session_puzzles_list(text,text)') as puzzles_list,
  to_regprocedure('public.a_profecia_session_puzzle_save(text,text,jsonb)') as puzzle_save,
  to_regprocedure('public.a_profecia_session_puzzle_delete(text,text,text)') as puzzle_delete,
  to_regprocedure('public.a_profecia_session_puzzle_unlock(text,text,text,text,text)') as puzzle_unlock,
  to_regprocedure('public.a_profecia_session_master_notes_get(text,text)') as master_notes_get,
  to_regprocedure('public.a_profecia_session_master_notes_save(text,text,text)') as master_notes_save;
```

Cada coluna deve mostrar o nome da função acompanhado dos tipos dos parâmetros, e não `NULL`.

## Se a sincronização automática dos Players continuar falhando

O recurso de puzzles é separado da sincronização das fichas. A sincronização automática dos Players depende das migrações anteriores do projeto, especialmente `20260922150708_v1_secure_player_reads_and_realtime.sql` (evento Realtime de mudança de ficha) e `20261013000000_fix_targeted_player_realtime.sql` (leitura direcionada usada após o evento).

Não execute migrações antigas às cegas: primeiro confirme se já foram instaladas. Se não estiverem, aplique as migrações pendentes na ordem correta e valide o resultado antes de testar em dois dispositivos. O botão de teste de carga faz uma simulação local e até 20 leituras; ele não simula 20 navegadores completos nem comprova sozinho a sincronização ponta a ponta.

## Verificação do cache do navegador

Após publicar os arquivos novos, confirme no console do navegador:

```js
window.__ASHEN_BUILD
```

O resultado deve ser `V1.5.26 · ASHEN TESTIMONY · ESTABILIDADE + SESSÕES`. Se mostrar uma versão anterior, o navegador/servidor ainda está entregando um bundle antigo.
