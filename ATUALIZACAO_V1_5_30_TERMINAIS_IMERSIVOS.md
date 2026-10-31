# Ashen Testimony — V1.5.30: Terminais imersivos

## Experiência para Players
- Antes de autenticar, cada puzzle aparece como um terminal restrito com interface de login personalizada pelo nome do terminal, título, enunciado e pista configurados pelo Mestre.
- As credenciais continuam sendo verificadas pela RPC segura do Supabase. Credenciais incorretas não montam a área de trabalho nem recebem o conteúdo do arquivo.
- Após autenticação correta, a interface troca para uma área de trabalho retrô inspirada em terminais/OS de recuperação, com console, painel de estado, tráfego de rede fictício e três arquivos clicáveis.
- `LEIA-ME.txt` e `ACESSO.LOG` são arquivos de atmosfera. O arquivo principal usa o título e conteúdo secreto que o Mestre cadastrou no puzzle, e só é recebido após o desbloqueio validado no servidor.
- Abrir e fechar arquivos ocorre na interface; trocar de sessão ou usuário limpa o estado de arquivos abertos e de puzzles desbloqueados localmente.
- Uma sequência de som sintetizada via Web Audio é disparada após o acesso concedido. O contexto de áudio é preparado no envio do formulário para respeitar as restrições de autoplay dos navegadores. O botão `SOM` permite repetir o som; se o navegador bloquear áudio, o restante do terminal funciona normalmente.
- Layout responsivo: no celular, os painéis laterais decorativos são ocultados para priorizar login, console e arquivos.

## Compatibilidade e segurança
- Não é necessária migração adicional do Supabase; o recurso utiliza as RPCs já instaladas de listagem e desbloqueio.
- Não foram alteradas autenticação, tabelas de fichas, RPCs de jogadores, sincronização global, estrutura das fichas ou regras de permissão.
- O texto do terminal e os arquivos são escapados antes de serem inseridos no HTML.

## Verificações executadas
- `node scripts/check-syntax.mjs`: aprovado (41 arquivos JavaScript).
- `node scripts/player-sync-regression.mjs`: aprovado (32 verificações).
- `node scripts/stability-audit.mjs`: aprovado (19 verificações).
- `node scripts/xss-audit.mjs --check`: 0 novas ocorrências em relação à baseline.
- `node --test scripts/unit/*.test.mjs`: 93/93 testes aprovados.
- O build visual do Vite e a experiência real de áudio ainda precisam ser confirmados no navegador publicado; este ambiente não possui dependências instaladas (`node_modules`).
