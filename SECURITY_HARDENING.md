# A Profecia — V1.0.7

## O que foi endurecido

- Autenticação do Mestre/Players validada no Supabase; o bundle do navegador não contém mais hash/senha de fallback.
- Token de sessão fica somente em `sessionStorage`.
- Estado global não é mais lido diretamente pela API REST pública: `a_profecia_get_global()` entrega somente branding/version para visitantes, estado completo ao Mestre e estado sem roster ao Player.
- Backups globais exigem sessão válida de Mestre.
- Uploads do Storage não são mais permitidos diretamente por `anon`; passam pela Edge Function `upload-asset`, que valida sessão, diretório, extensão/MIME e tamanho.
- Atualizações globais em Realtime passaram a enviar somente uma invalidação; o cliente busca os dados novamente com autorização. Isso evita transmitir o JSON global inteiro pelo canal Realtime.
- CSP foi apertada para remover HTTP e limitar conexões aos serviços usados.
- Proteções de sincronização e remoção de senha existentes foram preservadas.
- Versão marcada como `V1.0.7 · HARDENING DE SEGURANÇA`.

## Supabase

A migration `20260926140000_security_hardening.sql` e a migration de invalidação Realtime foram aplicadas ao projeto Supabase conectado.

A Edge Function `upload-asset` foi publicada e exige um token de sessão da aplicação. Ela usa uma chave secreta do ambiente do Supabase; nenhuma chave secreta é enviada ao navegador.

## Verificação

`node scripts/check-syntax.mjs` passou para os 6 arquivos JavaScript do projeto.

O build Vite não foi executado neste ambiente porque as dependências npm não estavam instaladas e a instalação não terminou dentro do ambiente de execução. Rode `npm install` e depois `npm run release:check` antes do deploy.

## Deploy

1. Substitua os arquivos do projeto pelos desta versão.
2. Mantenha as variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Não adicione `SUPABASE_SERVICE_ROLE_KEY` ou qualquer chave secreta ao Netlify/site frontend.
4. Faça o deploy normalmente no Netlify.
