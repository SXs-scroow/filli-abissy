A PROFECIA V61 — RECUPERAÇÃO E PROTEÇÃO DE DADOS

Esta versão parte da V60 e adiciona uma camada de recuperação para evitar que o estado do Supabase substitua silenciosamente uma versão local mais completa.

MUDANÇAS PRINCIPAIS
- Mantém todas as funções da V60, incluindo Tela da TV/Cinemáticas e dano de armas.
- Cria backups locais automáticos no IndexedDB antes de sincronizações importantes.
- Cria backups do estado remoto antes de uma escrita global.
- Na inicialização, compara o estado local com o remoto e evita substituir um estado local claramente mais completo.
- Se o estado local tiver sido alterado mais recentemente, ele pode prevalecer sobre um estado remoto antigo.
- Adiciona Câmara do Mestre > RECUPERAÇÃO.
- Permite criar backup local manual.
- Permite restaurar o último backup local.
- Permite consultar/restaurar backups remotos criados pela V61.
- O backup remoto usa a mesma tabela a_profecia_global, sem exigir uma nova tabela SQL.
- As imagens e vídeos já presentes no Supabase continuam sendo referenciados pelos dados; esta atualização não apaga arquivos do Storage.

IMPORTANTE SOBRE RESTAURAÇÃO
A V61 consegue recuperar automaticamente o que ainda existir no navegador, no Supabase ou nos backups criados a partir desta versão. Ela não pode recriar magicamente um arquivo que já tenha sido apagado definitivamente do Supabase Storage ou dados que nunca estejam mais disponíveis em nenhum backup.

DEPLOY
1. Extraia o ZIP.
2. Publique a pasta/projeto no Netlify normalmente.
3. Não apague nem recrie a tabela a_profecia_global.
4. Não execute comandos de DROP/DELETE no Supabase.
5. Depois do primeiro acesso como Mestre, abra Câmara do Mestre > RECUPERAÇÃO e crie um backup manual.

A V61 não exige mudança no SUPABASE_GLOBAL.sql existente.
