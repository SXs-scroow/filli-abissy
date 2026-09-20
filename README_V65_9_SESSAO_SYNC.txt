A PROFECIA — V65.9 (sessão + sincronização)

Só o app.js e o package.json mudaram. Todas as mudanças estão comentadas no código com "V65.9".

CAUSAS ENCONTRADAS (todas reproduzidas num navegador de teste com Supabase simulado)

1) VOLTAVA PARA O LOGIN A CADA RECARGA
   load() chamava normalize() -> derivedMax() -> characterRules(), que lê "state" enquanto
   "let state=load()" ainda estava sendo inicializado (ReferenceError). O catch devolvia o estado
   PADRÃO, então sessão e estado local eram perdidos em toda recarga (F5, celular retomando a aba).
   Correção: state existe antes de load(); o erro de load() agora aparece no console.
   A sessão agora também é guardada por aba (sessionStorage), então sair numa aba não desloga outra.

2) FUNDO / NOME DO SITE / MESA VOLTAVAM AO PADRÃO
   No boot, QUALQUER aparelho (Player inclusive) comparava o estado local com o do servidor e, se achasse
   o local "mais rico" ou mais recente, sobrescrevia o estado global do Mestre. Combinado com o item 1
   (estado local = padrão), isso apagava fundos e nome do site.
   Correção: só o Mestre escreve o estado global. No carregamento todos aplicam o que veio do servidor;
   a única exceção é o Mestre com alteração própria que nunca chegou ao servidor (fica marcada e é reenviada,
   com backup antes).
   Também: saveGlobalNow não descarta mais o salvamento em silêncio; remoteApplying não fica preso em true
   se o boot falhar; Player só grava a PRÓPRIA ficha no banco (antes reenviava cópias das fichas dos outros).

3) FICHA COMPLETA NUNCA ABRIA ("slots is not defined")
   slots() e addBag() eram chamadas mas não existiam. Todo Player caía na ficha em modo de recuperação,
   sem upload de retrato/wallpaper. As duas funções foram recriadas a partir do uso (CONFIRA o botão
   "Adicionar item": ele busca por ID ou nome, igual ao modal do Mestre).

4) Fundos enviados agora usam nome de arquivo único (backgrounds/<tipo>-<timestamp>.<ext>).

5) ROLAGENS DUPLICADAS NA TELA
   Cada atualização em tempo real (inclusive a de OUTRO Player) acrescentava de novo a última rolagem ao
   histórico visível. O banco estava certo, a tela mostrava repetido. updateDiceUI agora ignora rolagens já exibidas.

6) ABAS DA CÂMARA DO MESTRE VOLTANDO PARA "PLAYERS"
   Toda atualização em tempo real (um Player mexendo na ficha, por exemplo) reconstruía a Câmara inteira: a aba
   voltava para Players, a barra de abas voltava para o início e o arquivo de wallpaper escolhido era perdido.
   Agora a aba e a rolagem são lembradas, e a Câmara não é reconstruída por eventos que não afetam a aba aberta.

NÃO CORRIGIDO / NÃO INVESTIGADO
- Players "sumindo" na lista do Mestre: não reproduzi; provavelmente era efeito do item 2 (estado global apagado).
- Segurança: senhas dos Players ficam em texto puro no banco (legível com a chave pública), a senha do
  Mestre está no código do site e as policies do Supabase permitem escrita pública.

DEPOIS DE PUBLICAR
- O estado atual do banco (a_profecia_global/main) está com 0 fundos e nome "A Profecia".
  Refaça o nome e os fundos no painel do Mestre (Fundos / Identidade) — agora eles permanecem.
- Peça para todos recarregarem a página uma vez (cache do navegador).

COMO INSTALAR
Substitua app.js e package.json do seu projeto por estes e publique. Nada mais mudou (src/, public/, styles.css iguais).
