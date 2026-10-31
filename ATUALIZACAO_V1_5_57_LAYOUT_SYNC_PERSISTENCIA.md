# Ashen Testimony V1.5.57 — interface gótica, sincronização e persistência

## Interface
- Nova folha `styles-bloodborne.css`, carregada depois do CSS existente para aplicar o tema em toda a interface.
- Entrada em duas áreas: autenticação à esquerda e arte sombria existente do projeto à direita.
- Navegação lateral vertical em desktop, com a barra transformada em menu horizontal rolável em celulares/tablets.
- Linguagem visual unificada nas fichas, mapa, biblioteca, diário, classes, Nexus, terminais/puzzles e ferramentas do Mestre.
- Paleta carvão, cinza frio, branco envelhecido e metal desbotado; estados de erro e perigo continuam distintos.
- Foco visível, navegação por teclado e respeito a `prefers-reduced-motion`.
- Nenhum controlador de navegação ou componente de negócio foi reescrito para criar o tema.

## Sincronização e persistência dos Players
- Mantida a reconciliação do roster após reconexão Realtime, retorno à aba e recuperação da rede.
- Mantidas a fila durável por sessão, retentativas limitadas, confirmação de leituras e os guardas contra resposta atrasada, exclusão transitória e mudança de conta.
- Adicionado backup automático local de snapshots da ficha do Player e do rascunho de distribuição de pontos em IndexedDB, com remoção de campos sensíveis.
- A migração `20261026000000_player_autobackup_and_dedicated_points.sql` registra histórico de snapshots e mantém a alocação de pontos em um registro separado por Player. É aditiva e não apaga fichas.
- A rotina de validação agora inclui `npm run test:player-backup`.

## Validação
Consulte `RELATORIO_VALIDACAO_V1_5_57.md` para os resultados e limitações. Resumo: 62 arquivos JavaScript passaram na verificação de sintaxe; 43 checagens de sincronização e 148 testes unitários passaram; auditoria de estabilidade, auditoria XSS, caos de rede e teste de backup também passaram.

## Limitações e segurança
- O Vite não está instalado neste ambiente (`vite: not found`), então build/preview não puderam ser executados aqui.
- O teste E2E real com 15 contas não foi executado. A capacidade multiusuário segue sem certificação até passar em um Supabase isolado de homologação.
- Nenhuma migração foi executada, nenhum deploy foi feito e nenhum registro do Supabase de produção foi modificado.
