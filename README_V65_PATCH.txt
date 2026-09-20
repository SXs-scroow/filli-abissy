A PROFECIA — V65 + PATCH

O que foi corrigido nesta versão:

1. Players saíram do documento global a_profecia_global.
   Cada Player agora é uma linha própria em a_profecia_players.
   Isso impede que uma gravação antiga do estado global substitua a lista inteira.

2. Persistência por Player.
   Alterações de ficha, criação e exclusão usam o banco separado.

3. Recuperação/migração.
   O SQL SUPABASE_V65_PLAYERS.sql cria a tabela e migra automaticamente os Players
   que ainda estiverem no campo data.players do registro main antigo.

4. Login.
   O login tenta o estado local e, se necessário, consulta a tabela de Players.

5. Navegação.
   A aplicação não substitui mais o estado vivo por uma cópia antiga recebida pelo
   evento storage de outra aba.

6. Mestre.
   A Câmara do Mestre mostra "V65 + PATCH" no canto superior direito.

7. Limpeza.
   Arquivos README de versões antigas e imagens de referência que não são usados
   pelo código foram removidos do pacote.

INSTALAÇÃO DO BANCO

1. Abra o Supabase > SQL Editor.
2. Execute primeiro o SUPABASE_GLOBAL.sql caso a tabela global ainda não exista.
3. Execute SUPABASE_V65_PLAYERS.sql.
4. Publique esta V65 + PATCH no Netlify.
5. Depois de publicar, abra em uma janela anônima e teste criação/login de Player.

IMPORTANTE

A tabela de Players mantém os dados da ficha em JSON para preservar a estrutura
existente do site. Como o sistema atual usa login próprio do projeto, a senha do
Player fica dentro desse JSON. Isso resolve persistência e sincronização, mas não
substitui um sistema de autenticação real. Se o projeto for exposto publicamente
com necessidade de segurança forte, a próxima etapa recomendada é migrar o login
para Supabase Auth.
