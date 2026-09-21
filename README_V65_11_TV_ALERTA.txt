A PROFECIA — V65.11 (Modo TV + alerta sonoro pra iPhone)

app.js e styles.css mudaram (comentado "V65.11" no código).

------------------------------------------------------------------------------
1) BUG REAL DO MODO TV, ENCONTRADO E CORRIGIDO
------------------------------------------------------------------------------
Qualquer mudança do Mestre em QUALQUER outra parte do site (editar um item,
adicionar uma criatura, mudar o nome do site, etc.) reconstruía a Tela da TV
inteira do zero — inclusive reiniciando o vídeo que estava tocando, mesmo
sem nenhuma cinemática nova ter sido enviada pra TV. Agora a Tela da TV só
reage a mudanças que são DELA (cinemática/tela enviada); o resto é ignorado
por ela.

------------------------------------------------------------------------------
2) BOTÕES DA TV QUE DEPENDIAM DE MOUSE (:hover) — TV/CONTROLE NÃO TEM
------------------------------------------------------------------------------
O botão de tela cheia e o indicador de cena só apareciam com o mouse em
cima (":hover" no CSS). Numa TV controlada por controle remoto (ou celular
sem mouse), isso é invisível — não tem como "passar o mouse por cima" com
um D-pad. Puxei esse mesmo problema pra outro ângulo: em vez de só
consertar o hover, troquei a lógica inteira por uma tela de "▶ Iniciar Tela
da TV" GRANDE e sempre visível assim que a página abre, já com foco nela
(dá pra confirmar com o OK do controle sem precisar navegar).

Esse mesmo toque também resolve o problema de ÁUDIO: navegadores (inclusive
o Silk do Fire TV) bloqueiam vídeo com som até um toque real da pessoa.
Antes, as cinemáticas podiam simplesmente tocar sem som na TV. Agora, o
toque em "Iniciar Tela da TV" libera o som pro resto da sessão. Se mesmo
assim o navegador bloquear em algum vídeo específico, o app tenta de novo
mudo, em vez de ficar com a tela travada/preta.

------------------------------------------------------------------------------
3) FIRE TV STICK NA PRÁTICA
------------------------------------------------------------------------------
Fire TV Stick não vem com navegador de fábrica. Adicionei instruções na
Câmara do Mestre (aba TV) explicando isso: instalar "Silk Browser" (ou
"Firefox for Fire TV") pela Amazon Appstore, abrir e digitar/colar o
endereço da Tela da TV. Também adicionei um botão "Copiar link" pra facilitar
(o controle remoto do Fire TV não tem teclado físico, então digitar o
endereço manualmente é chato).

Também reforcei: se a Fire TV suspender a aba (troca de entrada HDMI,
sleep), ao voltar o app reaplica a cena atual sozinho, em vez de arriscar
ficar preso numa tela antiga.

------------------------------------------------------------------------------
4) ALERTA SONORO PRA iPhone (E QUALQUER APARELHO)
------------------------------------------------------------------------------
Nova seção na Ficha do Player: "ALERTA DE VEZ". O Player escolhe/envia um
som (ou cola uma URL direta) e ativa o alerta. Esse som toca automaticamente
quando:
- chega a vez dele na iniciativa da Mesa;
- o Mestre tira vida dele.

Mesma limitação honesta de sempre: navegadores (principalmente Safari/iOS)
só deixam tocar som "sozinho" (sem o dedo direto no botão) se a pessoa já
tiver tocado em ALGO na página antes. Fiz o app "destravar" isso no
primeiro toque em qualquer lugar da tela — deve funcionar na prática, mas
não é 100% garantido em toda versão de iOS. Se não tocar em algum aparelho
específico, o Player ainda vê o aviso na tela ("É a sua vez!"/"Você perdeu
X de vida.") mesmo sem o som.

------------------------------------------------------------------------------
BUG QUE VOCÊ PEDIU PRA EU PROCURAR (V65.10 -> V65.11)
------------------------------------------------------------------------------
Fiz uma varredura completa de novo (mesmo método: procurar chamada de
função que não existe, checar se toda função declarada continua existindo
depois de cada edição, node --check em tudo). Não encontrei mais nenhum bug
solto — os únicos itens desta rodada foram os do Modo TV acima, que já
estão corrigidos.

COMO INSTALAR
Substitua app.js e styles.css do seu projeto por estes.
