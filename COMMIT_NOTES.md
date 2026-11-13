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

## V1.5.79 — Perícias do C.R.I.S. e rolagem por perícia
- Novas perícias: Artes, Atualidades, Ciências, Diplomacia, Fortitude, Pilotagem, Profissão, Tática, Tecnologia, Vontade (repetidas puladas; nenhuma removida).
- Dadinho d20 em cada perícia (ficha, Modo Sessão e dossiê do Mestre). Modo "C.R.I.S." (d20 = atributo ligado, pega o maior; atributo 0 = 2d20 e fica com o menor) ou "Simples", escolhido em Regras de criação.
- Perícias "somente treinadas" (*) travadas sem treino; penalidade de carga (+) de −2 com mochila ≥ 80% da capacidade.
- Crítico/falha com animação na caveira; aba "Rolagens" no Mestre (ao vivo); ícones próprios para as perícias novas.
- Testes: scripts/unit/skill-roll.test.mjs (6 novos). XSS audit: helpers de marcação adicionados à lista segura.
- Vantagem/desvantagem (+1/−1 d20 na próxima rolagem, volta ao normal sozinha) e dado em cada atributo (teste de atributo puro). Testes: +4 em skill-roll.test.mjs.
