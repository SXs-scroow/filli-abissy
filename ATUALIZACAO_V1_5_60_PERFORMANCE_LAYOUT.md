# Ashen Testimony — V1.5.60

## O que mudou

### Sincronização e salvamento
- O salvamento de múltiplas fichas pelo Mestre agora agrupa alterações por ID de jogador e executa até quatro grupos em paralelo.
- Alterações da mesma ficha continuam sequenciais; isso evita que escritas do mesmo jogador se ultrapassem.
- A ordem dos resultados é preservada. Se alguma gravação falhar, a rotina espera as tarefas em andamento e mantém o lote na fila existente para repetição segura.
- Os carimbos de sincronização e a proteção de conflitos do servidor permanecem no fluxo.

### Interface e carregamento
- Imagens sem prioridade explícita recebem `decoding="async"`; imagens não essenciais são carregadas sob demanda. Logo/símbolo e imagens que já têm `loading` explícito preservam a prioridade definida.
- Corrigido o cálculo de largura do conteúdo principal para usar a área disponível ao lado da barra de navegação, evitando overflow lateral por largura calculada mais margens e padding.
- Reduzidos efeitos de desfoque e sombras caros de pintar em telas que permanecem abertas durante a sessão.
- Ajustes responsivos em telas estreitas, cartões de jogadores e navegação horizontal de abas.
- Atualizados os indicadores de versão para V1.5.60.

## Validação executada

- `npm run check`: passou — sintaxe validada em 64 arquivos JavaScript.
- `npm run check:scope`: não executou a verificação TypeScript porque a dependência opcional `typescript` não está instalada; o próprio script informou que pulou essa etapa.
- `npm run stability:check`: 23 verificações passaram.
- `npm run test:sync`: 43 verificações de regressão passaram.
- `npm run test:player-backup`: passou.
- `npm run audit:xss`: 0 novos achados além da baseline conhecida.
- `npm run test:maintenance-ai`: passou.
- `npm run test:chaos`: 10 testes passaram, 0 falharam.
- `npm run test:unit`: 154 testes passaram, 0 falharam.

## Limitações conhecidas desta entrega

- O build de produção (`vite build`) não pôde ser concluído neste ambiente porque o executável `vite` não está instalado. A instalação de dependências foi impedida por falha de resolução DNS do registry npm (`EAI_AGAIN`). Portanto, esta entrega foi verificada com as suites de código/teste listadas acima, mas ainda precisa passar por `npm install`/`npm ci` e `npm run build` em um ambiente com acesso ao registry.
- Não foi feito deploy. Nenhuma alteração foi aplicada no Supabase de produção.
- O teste real anterior de 15 clientes independentes no ambiente de staging validou login, 15 conexões Realtime, 15 salvamentos paralelos, leituras posteriores, entrega dos eventos a todos os clientes e reconexão. Esse teste não substitui a validação visual de todas as rotas em navegadores diferentes.
- A checagem visual automatizada no navegador não pôde ser realizada nesta execução; por isso, este pacote não declara a interface aprovada por screenshots/browser QA.

## Preservação

A atualização é sobre a base existente, não uma reescrita destrutiva. Não foram removidos módulos de funcionalidade, não foram executadas migrações e não foram modificados dados da produção.
