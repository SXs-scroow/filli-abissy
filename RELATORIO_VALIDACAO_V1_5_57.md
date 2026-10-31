# Relatório de validação — Ashen Testimony V1.5.57

## Resultado desta revisão
- Tema visual gótico global adicionado e carregado após a folha de estilos base.
- Menu lateral vertical em desktop; em telas estreitas volta a ser uma barra superior horizontal rolável.
- Tela de login reorganizada em painel de acesso à esquerda e arte existente do projeto à direita.
- Cores e componentes atualizados para fichas, Câmara do Mestre, mapa, classes, biblioteca, diário, Nexus, terminais e puzzles sem reescrever seus controladores.
- Backup local automático da ficha do Player e do rascunho de pontos incluído; campos de senha e segredos são excluídos do snapshot.
- Migração aditiva incluída para histórico de snapshots e isolamento da alocação de pontos por Player.
- Lógica já existente de reconciliação Realtime após reconexão/retorno à aba e fila durável preservada.

## Verificações executadas
- Sintaxe JavaScript: **62 arquivos válidos**.
- Regressão de sincronização: **43 verificações passaram**.
- Testes unitários: **148 passaram, 0 falharam** (inclui os novos testes estáticos do tema).
- Auditoria de estabilidade: **23 verificações passaram**.
- Auditoria XSS: **21 ocorrências conhecidas da baseline, 0 novas**.
- Caos de rede: **10 testes passaram**.
- Segurança de puzzles, proteção de fila, reconciliação, reparo de migração e fluxo de salvar/reler: **22 testes passaram**.
- Teste estático de backup automático e pontos por Player: **passou**.
- Teste sintático de CSS (tinycss2): **135 regras, 0 erros de parsing**.
- Teste de manutenção IA: **PASS**.
- `scope-check`: pulado porque TypeScript não está instalado; não é sucesso de type-check.

## Limitações de validação
- `npm run build` **não passou** neste ambiente: `vite: not found`. O ambiente não possui as dependências instaladas.
- Não foi possível fazer inspeção visual em navegador com o build compilado.
- O E2E real do Realtime com 15 contas não foi executado. A capacidade de múltiplos usuários ainda depende de validação no Supabase isolado de homologação.

## Dados e implantação
- Nenhuma migração foi executada automaticamente.
- Nenhum deploy foi feito.
- Nenhuma ficha, Player ou outro dado do Supabase de produção foi alterado.
- Antes de produção, aplicar as migrações apenas em homologação, testar UI desktop/mobile, rodar E2E com contas descartáveis e confirmar restore/histórico de Players.
