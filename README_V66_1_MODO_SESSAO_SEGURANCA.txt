A PROFECIA — V66.1 (em cima da sua V65.11)
Arquivos alterados: app.js, styles.css, index.html, src/globalSync.js, src/playerStore.js, package.json, .gitignore
Arquivos novos: SUPABASE_V66_AUTH_FASE1.sql (JÁ APLICADO no seu banco), SUPABASE_V66_AUTH_FASE2.sql (ainda NÃO aplicado), SUPABASE_V66_SEGURANCA.sql (já aplicado)

O QUE FOI FEITO NOS SEUS 8 PEDIDOS
1) Desempenho. Antes, cada tecla/clique gravava ~1 MB no navegador e clonava o estado inteiro (IndexedDB) na hora. Agora as gravações são agrupadas
   (~300 ms) e a cópia de recuperação é limitada a 1 por 45 s. O envio do estado global deixou de baixar de volta o estado inteiro, e a
   sincronização de fichas baixa só as que mudaram. Atualizações em tempo real não recriam mais a tela se nada mudou e não derrubam mais o
   que o Player está digitando (esperam ele sair do campo).
2) MP3 do celular na trilha do personagem (Ficha > Trilhas): botão "Enviar MP3 do celular" (até 25 MB, vai para o Supabase). Trilhas de áudio
   tocam num mini player fixo que NÃO para quando você troca de tela.
3) Ataque = Corpo × 4 e Defesa = Corpo × 5, automáticos (com bônus de classe). Fora do Slasher: ataque máx. 10 (dano puro de soco) e defesa máx. 15.
   Slasher sem limite. O Mestre agora edita "Bônus de ataque/defesa" (para armas, itens...) em vez de ataque/defesa fixos.
4) Determinação: emblema (mão) no canto da ficha e no Início, com o que resta (ex.: 12/12) e botões − / +. O Mestre define máximo e atual na
   edição do Player. Padrão: 12.
5) Cartão losango (retrato + nome + determinação) aparece na ficha enquanto há sessão ativa.
6) Modo Sessão: botão "Entrar em modo sessão" no fim de Informações básicas (ícone de cortina), com transição de cortina. Tela imersiva com
   losango + determinação, Vida/Sanidade, condições e abas: Mochila, Diário, Anotações, Perícias, Alma, Habilidades (e Magias). Botão para sair.
7) Efeitos: usar magia desconta o custo em Sanidade (já existia só na ficha; agora também no Modo Sessão). Fratura = 3 de dano + Debilitado
   (−2 Ataque/Defesa; sai junto com a Fratura). Sangramento e Veneno descontam vida sozinhos quando a VEZ do personagem volta na Mesa
   ("Avançar turno"), uma vez por rodada; condições com turnos também contam sozinhas.
8) Segurança/bugs: ver abaixo.

SEGURANÇA — O QUE MUDOU DE VERDADE
• Login agora é validado no SERVIDOR. Senhas de Player e do Mestre ficam só com hash (bcrypt) em tabelas que o público não enxerga.
• Só o Mestre autenticado grava o estado global; um Player só grava a PRÓPRIA ficha (e não altera notas do Mestre nem pontos concedidos).
• Limite de tentativas de login (10 por 10 min por login; 15 para o Mestre).
• Testado no banco como usuário anônimo: senha errada, ficha de outro, gravação global por Player, token falso, leitura direta das tabelas privadas.
• Botão "🔑 Senha do Mestre" (Câmara > Players). A senha inicial do Mestre no servidor é a ATUAL (Amarantos1805, que está pública em versões antigas do
  site): TROQUE LOGO.
• Todo mundo precisa entrar de novo uma vez depois de publicar.

ORDEM PARA PUBLICAR
1. Publique este projeto. 2. Entre como Mestre e troque a senha. 3. Só então rode SUPABASE_V66_AUTH_FASE2.sql (ela se recusa a rodar se a senha
   ainda for a antiga). A Fase 2 fecha a escrita pública de vez e apaga as senhas em texto do banco e do histórico.

LIMITAÇÕES
• Não consegui abrir um navegador aqui: testei o código simulando as telas e testei o banco de verdade, mas confira visualmente o Modo Sessão e a cortina.
• O Storage (imagens/músicas) ainda aceita envio público (limitado a 50 MB e a tipos de mídia).
• Os avisos ao vivo (TV/Nexus) usam um canal de broadcast aberto.
