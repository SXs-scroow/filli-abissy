# Ashen Testimony V1.5.25 — Modo Sessão + Puzzles

## Recursos desta versão

- Painel de combate mais cinematográfico, destaque do próximo participante e leitura visual de Vida/Sanidade.
- Condições existentes visíveis no painel de combate, com ações rápidas para aplicar/remover condições.
- Efeitos temporários personalizados por personagem, com contagem decrescente nos turnos desse personagem. O texto do efeito é narrativo/informativo e **não altera cálculos automaticamente**.
- Área de gerenciamento de terminais/puzzles na tela inicial do Mestre.
- Área **Terminais** no Modo Sessão do jogador, com login/senha fictícios, enunciado, pista opcional e arquivo revelado somente após autenticação no servidor.
- Área de **Segredos do Mestre** com notas privadas por sessão, armazenadas fora do JSON global.

## Importante: migration do Supabase

Antes de testar puzzles e notas privadas com contas reais, aplicar a migration:

`supabase/migrations/20261014120000_session_puzzles.sql`

No Supabase SQL Editor, abrir a migration, executar seu conteúdo e aguardar a conclusão. Depois, em **Project Settings / API**, recarregar o schema da API se as novas RPCs não forem encontradas. Não é preciso alterar as funções atuais de login, as fichas ou a tabela global.

A migration cria tabela privada e funções RPC com autorização baseada na sessão atual. O acesso direto às tabelas é revogado. Senhas de puzzle são guardadas com hash bcrypt (`crypt`/`gen_salt`), e respostas/arquivos secretos não são retornados na listagem pública de puzzles. Tentativas falhas são limitadas por usuário/terminal a 8 a cada janela de cinco minutos.

## Teste manual recomendado

1. Entrar como Mestre, abrir o Centro de Controle e criar um terminal.
2. Definir um login fictício, senha, enunciado, dica e arquivo secreto; salvar.
3. Entrar com uma conta de Player e abrir **Modo Sessão → Terminais**.
4. Confirmar que aparece o enunciado e não aparecem a resposta, o login correto nem o arquivo secreto.
5. Testar credenciais incorretas e depois as corretas; só o acesso correto deve revelar o texto.
6. Desativar o terminal e atualizar a lista; deve sumir da lista do jogador.
7. Como Mestre, salvar uma nota em **Segredos do Mestre** e confirmar que ela não aparece no terminal nem no JSON global.
8. Em combate, abrir **Ações rápidas**, aplicar condição com duração, avançar turnos do personagem e confirmar a expiração; adicionar/remover efeito personalizado e recarregar a ficha.
9. Testar em dois navegadores/aparelhos para verificar sincronização das fichas e atualização do combate.
10. Criar nova sessão e confirmar que puzzles da sessão anterior não aparecem como terminais da nova sessão.

## Limites conhecidos

- Não foi feita implantação remota da migration nem alterado o projeto Supabase conectado automaticamente.
- Efeitos personalizados são registros para interpretação do Mestre; não modificam fórmulas de ataque/defesa/dano.
- O painel mostra os dados de Vida/Sanidade provenientes das fichas existentes; a autenticação e a sincronização de fichas continuam nos serviços atuais.

## Validação automatizada nesta entrega

Resultados executados no pacote de trabalho:

- `npm run check`: passou; sintaxe verificada em 38 arquivos JavaScript.
- `npm run test:unit`: passou, 86 testes aprovados e 0 falhas, incluindo os testes de isolamento dos segredos dos puzzles.
- `npm run test:sync`: passou, 32 verificações de regressão da sincronização.
- `npm run stability:check`: passou, 19 verificações.
- `npm run audit:xss`: passou; 0 achados novos em relação à baseline existente.
- `npm run test:maintenance-ai`: passou.
- `npm run check:scope`: não executado completamente porque o TypeScript não está instalado; o script informou que pulou a análise.

Limitações do ambiente de validação:

- `npm install --no-audit --no-fund` não concluiu neste ambiente, então `npm run build` não pôde rodar por falta do Vite instalado.
- `npm run test:chaos` não iniciou por falta de `@supabase/supabase-js` neste ambiente.
- Não foi possível executar integração real contra o Supabase. A migration precisa ser aplicada no projeto do usuário e validada com uma conta Mestre e uma conta Player antes de publicar.

Esses resultados não equivalem a um teste completo de navegador, build de produção ou integração remota.
