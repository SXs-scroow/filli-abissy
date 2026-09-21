A PROFECIA — V65.9.1 (limpeza geral em cima da sua V65.9)

Parti da SUA versão (V65.9), não da minha anterior. Suas correções de
V65.9 (login/sessão por aba, "só o Mestre escreve o estado global",
slots()/addBag() recriadas, rolagens duplicadas, aba da Câmara do Mestre)
foram todas conferidas lendo o código com calma — estão corretas e bem
feitas. Só o app.js mudou de novo (1 ponto novo, comentado com "V65.9"
onde o problema estava).

------------------------------------------------------------------------------
1) BUG ENCONTRADO: normalize() dos Players usava as regras PADRÃO por um
   instante em toda recarga, mesmo que o Mestre tivesse personalizado as
   regras da campanha
------------------------------------------------------------------------------
Isso era um efeito colateral da sua própria correção do ReferenceError:
load() monta "saved" com as regras certas, mas o laço que chama normalize()
em cada Player ainda lia characterRules() do "state" global — que nesse
momento ainda apontava para o objeto padrão, não para o "saved" recém
montado. Corrigido: agora "state" passa a apontar para "saved" ANTES desse
laço rodar, então os Players são normalizados com as regras reais desde a
primeira renderização.

------------------------------------------------------------------------------
2) VERIFIQUEI SEU BANCO DE VERDADE (conectei via Supabase)
------------------------------------------------------------------------------
- Realtime: ATIVO nas duas tabelas (a_profecia_global e a_profecia_players). OK.
- Policies (RLS): leitura/escrita pública presentes nas duas tabelas e no
  bucket de imagens (a-profecia-assets, que está público). OK.
- Login duplicado: rodei uma consulta comparando logins ignorando
  maiúsculas/minúsculas — NENHUMA colisão encontrada nos Players atuais. OK.
- Reparei que existem 2 policies de INSERT com nomes diferentes em
  a_profecia_global ("public insert global" e "public write global") —
  sobra de patches SQL antigos rodados em cima um do outro. Não quebra nada
  (só redundante); posso limpar se quiser, mas não mexi sem seu ok.

------------------------------------------------------------------------------
3) ACHADO IMPORTANTE: o fundo/nome do site que sumiram (bug já corrigido
   por você) ainda estão recuperáveis
------------------------------------------------------------------------------
O mecanismo de backup automático (que já existia) guardou uma cópia de
19/09 às 16:53 com:
  - Nome do site: "Mansão drevis"
  - 4 fundos configurados (home, login, classes, perfil)

O registro "main" atual (o que o site usa agora) está com o nome padrão
"A Profecia" e só 1 fundo. Ou seja: o conteúdo antigo NÃO foi perdido, só
não está mais em uso.

NÃO restaurei isso sozinho — é uma escrita no seu banco ao vivo e quero sua
confirmação antes. Se quiser, eu aplico esse backup específico de volta no
registro "main" (nome do site + os 4 fundos) na próxima mensagem.

------------------------------------------------------------------------------
4) CONFERIDO E SEM PROBLEMA
------------------------------------------------------------------------------
- Rodei uma varredura em todo o app.js procurando chamadas de função sem
  a função existir (foi exatamente esse o bug do slots()/addBag() que você
  corrigiu) — não encontrei nenhuma outra ocorrência.
- node --check em todos os arquivos JS: sem erro de sintaxe.

------------------------------------------------------------------------------
COMO INSTALAR
------------------------------------------------------------------------------
Substitua só o app.js do seu projeto por este e publique. package.json,
src/, public/, styles.css: iguais aos da sua V65.9.
