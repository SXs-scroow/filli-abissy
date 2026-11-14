# Ashen Testimony — Arquivo de Campanha (V1.5.77)

## O que foi adicionado

- Nova página **Arquivo** para jogadores, em modo de leitura.
- Nova ferramenta **Arquivo de Campanha** no menu **Mais ferramentas** da Câmara do Mestre.
- Registros por categoria: acontecimentos, sessões, pessoas/personagens, locais, evidências, mortes e documentos.
- Linha do tempo, busca local, filtro por categoria e exportação JSON.
- Visibilidade: somente Mestre, todos os jogadores, grupo selecionado ou um jogador específico.
- Edição com controle de revisão para detectar conflito entre dispositivos.
- Arquivamento lógico (sem apagar o registro da auditoria), consulta de arquivados, restauração e histórico de alterações.
- Atualização em tempo real por aviso sem conteúdo privado; os clientes consultam novamente a RPC autenticada.

## Ativar no Supabase

1. Abra o projeto no Supabase e entre em **SQL Editor**.
2. Abra `supabase/migrations/20261114160000_campaign_archive.sql` neste pacote.
3. Execute a migração completa uma única vez.
4. Publique a aplicação V1.5.77.
5. Entre como Mestre, abra **Mestre → Mais ferramentas → Arquivo de Campanha** e crie um registro de teste com visibilidade **Somente Mestre**.
6. Entre com um usuário Player e confirme que esse registro não aparece. Depois crie um registro de teste com visibilidade **Todos os jogadores** e confirme que ele aparece.
7. Exclua os dois registros de teste pela ação **Arquivar** se não forem necessários.

A migração cria tabelas e funções novas; não substitui tabelas existentes nem altera o JSON global. As tabelas têm RLS habilitado e acesso direto revogado para `anon` e `authenticated`. As funções RPC validam o token de sessão próprio do Ashen Testimony e filtram o conteúdo antes de devolvê-lo.

## Limitações desta primeira versão

- O campo de documento guarda texto; anexos/arquivos ainda não fazem parte deste MVP.
- As relações implementadas nesta versão são por personagem relacionado. Ligações entre registros, relatórios formatados e anexos ficam para uma etapa posterior.
- A lista carrega até 500 registros por consulta.
- Não existe modo offline para novos registros do Arquivo: o conteúdo privado só é salvo após confirmação do Supabase.

## Segurança e implantação

A migração ainda precisa ser aplicada no Supabase do proprietário do projeto. Este pacote não executa nem altera o banco remoto. Não publique a aplicação antes de aplicar a migração, pois as funções RPC ainda não existirão e a interface mostrará uma mensagem de orientação.
