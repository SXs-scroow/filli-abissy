# Preparação para commit — Ashen Testimony V1.5.76

## Ajustes
- Atualizado o teste de regressão do laboratório de carga para reconhecer a ferramenta `load` no menu dinâmico `Mais ferramentas` (`data-tool`), em vez de exigir uma aba fixa `data-tab`.
- Atualizada a verificação do escopo do salvamento de entidade para considerar também a variável `grantedNote`, já presente no handler.

## Verificações executadas
- `npm run check`: passou.
- `npm run check:scope`: passou.
- `npm run stability:check`: 23 verificações passaram.
- `npm run test:sync`: 43 verificações passaram.
- `npm run test:player-backup`: passou.
- `npm run audit:xss`: 0 novas ocorrências.
- `npm run test:unit`: 199 testes passaram.
- `npm run test:maintenance-ai`: passou.
- `npm run test:chaos`: 10 testes passaram.

## Pendente no ambiente de preparação
- `npm run build` não pôde ser concluído porque as dependências não foram instaladas neste ambiente (`vite: not found`). A tentativa de `npm install --no-audit --no-fund` expirou por indisponibilidade/timeout de acesso ao registro de pacotes.
- Antes de publicar, execute `npm install --no-audit --no-fund` e `npm run release:check` em um ambiente com acesso ao npm.

O ZIP original não continha metadados Git (`.git`), então este pacote está preparado para ser adicionado ao repositório, mas nenhum commit foi criado.
