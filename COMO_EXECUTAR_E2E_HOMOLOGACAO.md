# Teste E2E de sincronização — homologação isolada

O script `scripts/e2e/staging-sync-load.mjs` é a etapa seguinte para verificar a meta de 15 pessoas com acesso concorrente ao Supabase real. Ele usa 15 clientes Supabase independentes com contas de Player descartáveis, faz 15 gravações concorrentes, confirma as leituras por cada sessão, confere o roster com uma sessão Mestre e mede os eventos Realtime.

## Aviso de segurança

**Execute somente em um projeto Supabase separado, de homologação e com 15 contas de Player descartáveis. Não use a URL nem as contas de produção.** O teste altera temporariamente o HP dessas 15 fichas e depois tenta restaurar os valores originais e verificá-los. Os valores de HP devem voltar ao inicial, mas os carimbos de sincronização e o histórico de auditoria do banco terão registros de teste; por isso as contas e o projeto precisam ser descartáveis.

O script não tem defaults de URL, não registra logins/senhas no relatório e aborta sem a confirmação explícita `ASHEN_STAGING_CONFIRM=I_CONFIRM_DISPOSABLE_STAGING_ONLY`.

## Variáveis necessárias

- `ASHEN_TEST_SUPABASE_URL`: URL do projeto de homologação.
- `ASHEN_TEST_SUPABASE_ANON_KEY`: chave pública/anon desse projeto de homologação.
- `ASHEN_TEST_MASTER_PASSWORD`: senha da conta Mestre de teste.
- `ASHEN_TEST_USERS_JSON`: JSON com pelo menos 15 contas descartáveis, por exemplo `[ {"login":"load01","password":"..."}, ... ]`.
- `ASHEN_STAGING_CONFIRM`: precisa ser exatamente `I_CONFIRM_DISPOSABLE_STAGING_ONLY`.

Instale as dependências do projeto em uma máquina com acesso ao registro npm e rode `npm run test:e2e:staging-sync`. O comando exige as variáveis anteriores no ambiente. O script informa contagem de gravações e leituras bem-sucedidas, latências p50/p95/máxima, quantas das 15 sessões receberam todos os 15 eventos Realtime e se a limpeza foi verificada.

## Critério de aprovação

O teste só retorna sucesso se as 15 gravações concorrentes foram confirmadas, as 15 leituras individuais e a leitura do Mestre bateram, cada uma das 15 sessões recebeu os 15 eventos Realtime distintos e o HP inicial de cada ficha descartável foi restaurado e relido com sucesso. Mesmo com aprovação, isso certifica apenas o cenário e o projeto testados, não qualquer número de usuários nem a latência de todo ambiente de produção.
