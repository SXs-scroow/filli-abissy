A PROFECIA — V65.8 PATCH DE SESSÃO/NAVEGAÇÃO

Este patch NÃO mexeu na estrutura do projeto. Só o arquivo app.js foi alterado
(3 pontos, comentados no próprio código com "V65.8"), mais este README.

------------------------------------------------------------------------------
1) O SITE VOLTAR SOZINHO PARA "INÍCIO / INFORMAÇÕES BÁSICAS"
------------------------------------------------------------------------------
CAUSA ENCONTRADA:
O app é uma SPA (uma página só). Ao carregar, ele sempre chamava render()
sem argumento, que por padrão abre a aba "home" ("Início" pro Mestre,
"Informações básicas" pro Player) — não importa em qual aba você estava.

Isso não é perceptível num F5 manual, mas em celular é MUITO comum o
navegador recarregar sozinho uma aba que ficou em segundo plano (ex.: você
sai pra ver o WhatsApp/Discord e volta). Cada uma dessas recargas silenciosas
jogava o Player de volta para "Informações básicas", mesmo que ele estivesse
no meio da Ficha, Classes, Diário, Biblioteca etc. Achamos que é essa a causa
principal do "o site fica voltando para o início".

CORREÇÃO:
Agora, toda vez que você navega para uma aba, o app guarda qual aba é essa
no sessionStorage (isso é por aba do navegador, não é compartilhado entre
Players nem entre dispositivos — é só "lembrar onde eu estava nesta mesma
aba"). Quando a página recarrega sozinha, ela volta para a MESMA aba em vez
de forçar "Início".

Isso é adicional à sessão em si: a sessão de login já era restaurada do
localStorage antes; o que faltava era restaurar TAMBÉM a aba.

------------------------------------------------------------------------------
2) "FICHA SOME" — COLISÃO DE LOGIN NO PAINEL DO MESTRE
------------------------------------------------------------------------------
CAUSA ENCONTRADA:
O banco (Supabase) tem uma regra que impede dois Players com o mesmo login
IGNORANDO maiúsculas/minúsculas (ex.: "Joao" e "joao" contam como o mesmo
login pro banco). Mas a tela de EDITAR Player do Mestre checava duplicidade
de um jeito sensível a maiúsculas/minúsculas. Resultado possível: o Mestre
edita o login de um Player e sem querer cria uma dessas "colisões". A partir
daí, TODAS as tentativas de salvar aquele Player no banco passam a falhar
silenciosamente (o app só registra um aviso no console, sem avisar ninguém
na tela). Do ponto de vista de quem está jogando, a ficha "para de salvar" —
e se essa pessoa entrar de outro aparelho, vê uma versão antiga, como se a
ficha tivesse "sumido".

CORREÇÃO:
A checagem de login duplicado na tela de edição do Mestre agora ignora
maiúsculas/minúsculas, igual ao banco. Essa colisão não pode mais ser criada
pela interface.

RECOMENDAÇÃO ANTES DA SESSÃO:
Se em algum momento você (Mestre) editou manualmente o login de um Player,
vale abrir o SQL Editor do Supabase e rodar esta consulta só para conferir
se já existe alguma colisão antiga (de antes deste patch):

  select login, count(*) 
  from public.a_profecia_players 
  where deleted_at is null 
  group by lower(login) 
  having count(*) > 1;

Se voltar alguma linha, me avise o(s) login(s) — eu ajudo a corrigir sem
precisar mexer no restante dos dados.

------------------------------------------------------------------------------
3) TELA TRAVAR OU FICAR "PRESA" SE UMA PARTE DA FICHA DER ERRO
------------------------------------------------------------------------------
A ficha do Player (sheet()) já tinha uma proteção: se der erro ao montar
alguma parte dela, ela cai numa versão simplificada em vez de quebrar tudo.
Isso já existia (V65.6).

O que NÃO existia era essa mesma proteção para as outras abas (Início,
Classes, Diário, Biblioteca, Nexus, Câmara do Mestre, Mesa). Se qualquer
uma delas desse erro ao montar a tela, a página simplesmente travava naquele
estado sem aviso nenhum — e a única saída era recarregar (o que, antes da
correção 1, ainda te jogava pro Início).

CORREÇÃO:
Agora TODAS as abas têm essa mesma rede de segurança: se der erro ao montar
a tela, aparece um aviso pedindo para tentar de novo ou recarregar, mas a
sessão continua logada e o menu continua funcionando — em vez de travar ou
voltar para outra aba.

------------------------------------------------------------------------------
VALIDAÇÃO FEITA
------------------------------------------------------------------------------
- node --check em app.js, src/main.js, src/globalSync.js, src/playerStore.js,
  src/supabaseConfig.js: OK (sem erro de sintaxe).
- Não foi possível rodar "npm run build" (Vite) neste ambiente por falta de
  acesso à rede para instalar dependências. Antes da sessão, se possível,
  rode "npm install && npm run build" (ou publique direto) e abra o site
  normalmente uma vez para confirmar visualmente.

------------------------------------------------------------------------------
O QUE EU NÃO CONSEGUI TESTAR AO VIVO
------------------------------------------------------------------------------
Não tenho como abrir seu Supabase nem simular vários navegadores jogando ao
mesmo tempo. Os três pontos acima são bugs REAIS que encontrei lendo o
código com calma (não são só suposições soltas) e as correções são diretas
e pontuais, mas o teste final com pessoas de verdade, em celulares de
verdade, continua sendo importante. Se algo ainda acontecer na sessão, abra
o console do navegador (F12 > Console) assim que acontecer — agora o app
deixa avisos mais claros ali (procure por linhas que começam com
"[A Profecia]") — e me manda o texto. Isso me permite corrigir a causa exata
em vez de arriscar.
