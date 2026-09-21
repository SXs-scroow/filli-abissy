A PROFECIA — V65.10 (PDF + vibração)

Só app.js e styles.css mudaram (tudo comentado com "V65.10").

1) BAIXAR FICHA EM PDF
Botão "Baixar ficha em PDF" ao lado de "Salvar ficha". Ele usa o próprio
"Salvar como PDF" da caixa de impressão do navegador — não adicionei
nenhuma biblioteca nova (menos risco no build de agora pra sua sessão).
Em troca, o layout não é pixel-perfect: vira uma versão em preto e branco,
sem menu/botões/dados, com cada bloco da ficha em uma caixinha. Se depois
você quiser um PDF com o visual exato do site, dá pra evoluir isso com uma
biblioteca dedicada (jsPDF/html2canvas) — mas aí precisa rodar "npm install"
antes de publicar.

2) VIBRAÇÃO NO CELULAR
- Quando o Mestre tira vida de um Player, o celular DAQUELE Player vibra
  e aparece um aviso ("Você perdeu X de vida.").
- Quando a Mesa (iniciativa) passa a vez para um Player, o celular dele
  vibra e aparece "É a sua vez!" — mesmo que ele esteja em outra aba do
  site.

IMPORTANTE — LIMITAÇÃO REAL, NÃO TEM COMO CONTORNAR:
iPhone (Safari/iOS) NÃO tem a API de vibração, em nenhum navegador, nem
como PWA. Isso é uma limitação da Apple, não do app. Em Android/Chrome
funciona normalmente. Nos aparelhos sem suporte, o app simplesmente não
vibra — não trava nem dá erro, só não faz nada.

BUG ENCONTRADO E CORRIGIDO DE PASSAGEM: "Avançar turno" na Mesa marcava a
ação de quem estava na ordem em que foi ADICIONADO à lista, não na ordem
de iniciativa mostrada na tela. Agora usa a mesma ordenação (maior
iniciativa primeiro) nos dois lugares — isso também era necessário pra
"de quem é a vez" ficar confiável o bastante pra vibrar o celular certo.

COMO INSTALAR
Substitua app.js e styles.css do seu projeto por estes e publique. Nada
mais mudou.
