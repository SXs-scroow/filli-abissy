A PROFECIA — V66.4 (PDF colorido, bug do Modo TV, achado de segurança importante)

app.js e styles.css mudaram. Nenhum arquivo SQL novo desta vez.

------------------------------------------------------------------------------
🔴 ACHADO MAIS IMPORTANTE — LEIA ANTES DA PRÓXIMA SESSÃO
------------------------------------------------------------------------------
Entrei no seu Supabase pra fazer a checagem de segurança que você pediu (item 8)
e achei isto: a FASE 2 do patch de autenticação (SUPABASE_V66_AUTH_FASE2.sql)
NUNCA foi rodada. Na prática isso significa que, embora o login novo (com
senha com hash e token) já esteja funcionando, as tabelas do banco AINDA
aceitam escrita direta por qualquer pessoa com a chave pública do site,
por fora do login — o cadeado da porta da frente foi trocado, mas a porta
dos fundos continua destrancada.

Também conferi: a senha do Mestre no servidor tem a mesma data de quando a
Fase 1 foi instalada — ou seja, quase certamente ainda é a senha antiga
(Amarantos1805), que o próprio patch anterior avisou que ficou pública em
versões antigas do site. Boa notícia: não vi nenhuma tentativa de login
registrada no banco, então não há sinal de que alguém tenha usado isso.

O QUE FAZER, NESSA ORDEM (a Fase 2 se recusa a rodar fora dessa ordem):
1. Publique este projeto e entre como Mestre.
2. Câmara do Mestre > Players > botão "🔑 Senha do Mestre" — troque para uma
   senha nova, que só você conhece.
3. Só então rode o SUPABASE_V66_AUTH_FASE2.sql (o mesmo arquivo que já está
   no seu projeto, na raiz) no SQL Editor do Supabase.
Se quiser, eu mesmo rodo o passo 3 por você depois que confirmar que já
trocou a senha no passo 2 — é só me avisar.

------------------------------------------------------------------------------
1) PDF DA FICHA AGORA SAI COLORIDO
------------------------------------------------------------------------------
Antes eu tinha deixado a impressão em preto e branco de propósito (economia
de tinta). Troquei para manter as cores reais do site: os navegadores só
imprimem cor de fundo se a gente pedir explicitamente (print-color-adjust),
então isso já estava sendo apagado sem eu ter avisado direito. Continua sem
imprimir menu/botões/modais.

------------------------------------------------------------------------------
2) BUG REAL DO MODO TV, ENCONTRADO E CORRIGIDO
------------------------------------------------------------------------------
Ao trocar de uma cena de IMAGEM (ou tela preta/vermelha) direto para um
VÍDEO, a imagem/tela anterior nunca era removida da tela — ficava por trás
do vídeo novo. Corrigido: agora, ao entrar um vídeo, tudo que não é vídeo
é removido primeiro. Também cobri o caso raro de duas trocas de vídeo muito
rápidas deixando mais de um vídeo "esquecido" ao mesmo tempo.
Se você tiver visto outros erros específicos no Modo TV além deste (uma
mensagem de erro, uma tela específica travando), me descreve o que apareceu
que eu vou direto na causa.

------------------------------------------------------------------------------
3) SEUS ITENS 2 E 3 — JÁ ESTAVAM PRONTOS, CONFERI E ESTÁ TUDO CERTO
------------------------------------------------------------------------------
- Item 2 (MP3 do celular na trilha do personagem): já existe, botão
  "🎵 Enviar MP3 do celular" na Ficha > Trilhas. Testei a amarração do
  código, está correta.
- Item 3 (Ataque/Defesa = Corpo × 4 / Corpo × 5, com teto 10/15 fora do
  Slasher e sem teto no Slasher; magia descontando Sanidade pelo custo;
  Fratura = dano + Debilitado; Sangramento/Veneno descontando vida sozinhos
  quando a vez volta pro personagem): tudo isso já está implementado
  exatamente como você descreveu — conferi célula por célula no código.

Uma coisa que eu não entendi no seu pedido: você mencionou "com mínima de
18" junto da fórmula de ataque/defesa, mas não consegui encaixar esse
número em lugar nenhum da regra (não é o mínimo de ataque, nem de defesa,
nem bate com o teto de Vida). Pode me explicar o que é esse "mínimo de 18"
que eu ajusto certinho?

COMO INSTALAR
Substitua app.js e styles.css do seu projeto por estes.
