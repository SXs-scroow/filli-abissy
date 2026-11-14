# Ashen Testimony — entrega integrada V1.5.77

Esta versão parte do projeto existente e reúne os ajustes da Central de Combate com o novo Arquivo de Campanha. Não é um projeto substituto.

## Central de Combate

- Iniciativa editável para Players e criaturas/NPCs participantes.
- Ordenação por iniciativa, do maior para o menor, preservando a ordem anterior em empates.
- Criaturas/NPCs visíveis no painel de participantes, com turno e iniciativa.
- Remoção de criatura do encontro sem apagar seu cadastro da biblioteca.
- Registro da reorganização de iniciativa no histórico do combate.

## Arquivo de Campanha

- Linha do tempo com acontecimentos, sessões, personagens, locais, evidências, mortes e documentos.
- Busca e filtro por categoria.
- Visibilidade por Mestre, todos os jogadores, grupo selecionado ou jogador específico.
- Edição com controle otimista de revisão para detectar alterações concorrentes.
- Arquivamento lógico, restauração e histórico de auditoria.
- Atualização em tempo real por aviso sem conteúdo privado.
- Exportação JSON dos registros que a sessão atual está autorizada a consultar.
- Cache privado limpo ao trocar o token de sessão no mesmo navegador.

## Dados e segurança

O Arquivo fica em tabelas próprias e não é incluído no JSON global compartilhado. As RPCs validam o token de sessão próprio da aplicação. O acesso direto às tabelas é revogado e os registros visíveis aos jogadores são filtrados no servidor.

A migração é aditiva: `supabase/migrations/20261114160000_campaign_archive.sql`. Ela precisa ser executada no Supabase do projeto antes de publicar a interface V1.5.77. Este pacote não executa nem altera o banco remoto.

## Verificações realizadas nesta cópia

- 226 testes unitários: aprovados.
- 43 verificações de regressão de sincronização: aprovadas.
- 23 verificações de estabilidade: aprovadas.
- 10 testes de caos de rede: aprovados.
- Auditoria XSS: zero novas ocorrências em relação à baseline existente.
- Verificação de sintaxe: 76 arquivos JavaScript aprovados.
- Verificações de backup de Players, manutenção e escopo: aprovadas.

## Validações pendentes

- O build de produção não pôde ser executado neste ambiente porque a dependência Vite não está instalada (`vite: not found`).
- A migração SQL não foi executada em um banco Supabase real nesta sessão. É necessário aplicá-la e validar o fluxo Mestre/Player em um ambiente de teste antes da publicação.

## Limitações do MVP do Arquivo

- Documentos são texto; anexos não estão incluídos.
- Relações entre registros ainda não estão implementadas; existe apenas vínculo com um Player/personagem.
- A consulta retorna até 500 registros por vez.
- Não há gravação offline de registros privados.
