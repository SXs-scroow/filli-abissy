# Ashen Testimony V1.6.2 — ajustes após verificação real

## Alteração aplicada neste pacote

O verificador agora reconhece quando está sendo executado pelo Vite em um endereço HTTP local (localhost ou IP privado):
- HTTPS aparece como **não verificado**, pois deve ser testado no domínio HTTPS publicado.
- Captura de tela aparece como **não verificado** nesse contexto, pois `getDisplayMedia` depende de contexto seguro e navegador compatível.
- Rotas `/api/*` aparecem como **não verificadas** no Vite dev, pois são funções serverless da Vercel e não são servidas pelo `vite` puro.

Isso não mascara falhas em produção: no domínio público, respostas 404/HTML continuam reprovando as rotas, e HTTPS/captura continuam sendo verificadas normalmente.

## O que ainda exige ação externa

1. **Supabase — memória da Ashen AI:** aplicar `supabase/migrations/20261118190000_ashen_ai_memory.sql` no SQL Editor do projeto Supabase correto. O ZIP já contém a migração e o código cliente usa os nomes de parâmetros compatíveis. Não foi possível executar SQL no projeto remoto sem acesso autorizado ao painel.
2. **Realtime:** confirmar que Realtime/Broadcast está habilitado e que a tabela `public.a_profecia_players` está configurada para os eventos necessários. O teste registrou 4 avisos perdidos em 300; isso precisa ser repetido em homologação com a mesa sem outras gravações concorrentes e analisado junto aos limites/uso do plano Supabase. Não alterei a semântica de sincronização nem removi a confirmação de gravação.
3. **Regras globais:** no Mestre → Regras, selecionar “Manual de Rolagens” e salvar os limites para persistir `rollSystemV=2` no estado global.
4. **TURN:** opcional para melhorar conectividade de participantes em 4G/5G, CGNAT e redes restritas. Configurar credenciais TURN em Mestre → Nexus → Servidor TURN.
5. **Deploy:** publicar na Vercel e executar a verificação usando o endereço HTTPS de produção/staging. As rotas `api/ashen-ai.js`, `api/maintenance-ai.js` e `api/resolve-spotify.js` já existem no projeto.

## Validação executada neste pacote

- `node --check src/siteVerification.js` — aprovado.
- `node --check scripts/unit/site-verification.test.mjs` — aprovado.
- Os nove casos do arquivo `scripts/unit/site-verification.test.mjs` reportaram `ok`, incluindo o novo caso para HTTP local. O processo de teste não encerrou dentro do limite do ambiente de execução por causa de um timer preexistente no teste de timeout; portanto, não declaro a suíte completa nem o build como aprovados.
- `npm install` não concluiu no ambiente de execução; build de produção não foi validado.

## Importante

Este pacote não afirma que a aplicação remota, banco Supabase ou deploy Vercel foram corrigidos. Essas etapas dependem de acesso ao ambiente remoto e de uma nova verificação após publicação.
