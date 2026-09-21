A PROFECIA — V66.3 (Cortina dos Players na Mesa)

Parti da SUA V66.2 (não mexi na estrutura, nem no que você/quem te ajudou já
tinha corrigido). Só app.js e styles.css mudaram.

------------------------------------------------------------------------------
O QUE MUDOU NA ABA MESA
------------------------------------------------------------------------------
Nova seção "CORTINA DOS PLAYERS", entre o cabeçalho da sessão e o painel de
iniciativa (que continua existindo do jeito que estava, para marcar ordem de
ação de Players E Monstros).

Antes de clicar em "▶ Iniciar sessão": a cortina aparece fechada para todos
os Players, só com o nome — nada pode ser aberto ainda.

Depois de iniciar a sessão: cada Player vira um cartão com um botão
"▶ Abrir cortina". Fechado, mostra só o nome e a vida atual. Aberto, mostra:
- o cartão losango (retrato + determinação), reaproveitando exatamente o
  mesmo visual do "Modo Sessão" do próprio Player — a referência da imagem
  que você mandou é esse mesmo losango com a garra vermelha;
- a determinação, com os botões − / + do LADO do retrato, editável ali
  mesmo pelo Mestre;
- a barra de Vida e a barra de Sanidade, também editáveis ali (clique,
  mude o número, sai do campo — já salva e sincroniza);
- Atributos treinados e Perícias treinadas (só o que tem pontos > 0 — não
  lista os oito atributos/todas as perícias, só o que o personagem
  efetivamente tem treinado).

Cada Player abre/fecha independente dos outros — dá pra ter vários cartões
abertos ao mesmo tempo durante a sessão. Fica salvo no navegador do Mestre
(sessionStorage) qual cartão você deixou aberto, então não reseta sozinho
se a página recarregar no meio da sessão.

------------------------------------------------------------------------------
REAPROVEITAMENTO, NÃO REESCRITA
------------------------------------------------------------------------------
Não criei um sistema visual novo do zero: usei o mesmo `sessionDiamondCard`,
`resourceBarMarkup` e classes de atributo/perícia treinada que a V66.1 já
tinha construído para a ficha e o Modo Sessão do Player. A ideia é que a
Mesa do Mestre e a tela que o Player vê tenham a MESMA linguagem visual.

------------------------------------------------------------------------------
CONFERÊNCIA NA SUA V66.2
------------------------------------------------------------------------------
Revisei o que veio pronto: o novo sistema de login por token (bcrypt no
servidor, RPCs a_profecia_master_login/player_login/whoami/logout), a
correção do "DET_DEFAULT_MAX before initialization", e a proteção de
sessão-sem-token caindo pro login. Está bem feito e consistente — não achei
bug novo nisso. Rodei minha varredura de sempre (função chamada que não
existe + node --check em tudo) no arquivo inteiro: nada encontrado.

Você mencionou "quero que você arrume umas coisas" mas só detalhou a Mesa —
me diga o resto que você quer corrigido que eu entro nisso na sequência.

COMO INSTALAR
Substitua app.js e styles.css do seu projeto por estes e publique.
