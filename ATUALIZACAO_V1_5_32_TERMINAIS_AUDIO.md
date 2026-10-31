# Ashen Testimony V1.5.32 — Terminais com áudio

## O que mudou
- Ao aceitar as credenciais corretas, o terminal reproduz o áudio de inicialização enviado e mostra uma sequência animada de recuperação do sistema antes de exibir a área de trabalho.
- Os rótulos visíveis não expõem IDs internos de sessão/puzzle.
- O Mestre pode anexar até 3 gravações por terminal, com limite de 750 KB por áudio. Elas ficam persistidas no banco e aparecem como arquivos clicáveis depois da autenticação.
- Os áudios não são enviados na listagem de terminais dos jogadores; o RPC de desbloqueio só os retorna depois de validar as credenciais.
- A animação respeita `prefers-reduced-motion`.

## Banco de dados
A migração `20261015054816_session_puzzle_audio_20261015.sql` adiciona `audio_files` e atualiza as RPCs de listagem, salvamento e desbloqueio. Ela foi aplicada ao projeto Supabase conectado para esta entrega, e consta no histórico de migrações. Para usar este ZIP em outro projeto, aplique o arquivo antes de habilitar os anexos.

## Verificações executadas
- `node --check app.js`: passou.
- `node scripts/check-syntax.mjs`: passou (41 arquivos JavaScript).
- Auditoria de sincronização: 32 verificações passaram.
- Testes unitários/regressão: 93 passaram.
- Auditoria de estabilidade: 19 verificações passaram.
- Testes de caos de rede: 10 passaram.
- Teste de manutenção de IA: passou.
- Auditoria XSS: nenhuma nova ocorrência.

**Limitação de validação:** não consegui executar `vite build` neste ambiente porque a instalação das dependências ultrapassou o limite de execução e o executável do Vite não ficou disponível. O ZIP contém o código-fonte; recomenda-se executar `npm install` e `npm run build` no ambiente de desenvolvimento antes de publicar.
