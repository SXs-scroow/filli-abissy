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

## Monstros e combate (V1.5.80)
**Correções**
- Aba Mestre → Monstros: os botões (−5/+5 Vida, Editar, + Rodada, Rolar ataque/dano, Duplicar, Excluir) eram ligados antes de a lista ser desenhada e nunca respondiam. Agora há um único listener delegado em `#monsterResults`, que sobrevive à busca e a re-renderizações.
- Vida do monstro é lida como número (valor salvo como texto quebrava a conta) e respeita 0..máx.

**Combate (card do monstro)**
- Barra de vida, ATQ/DEF/Dano, condições, botões −5/−1/+1/+5 e campo de valor livre (Dano/Cura; Enter aplica dano).
- ↶ Desfazer o último dano/cura do monstro.
- 🎲 Atacar / 🎲 Dano direto no card.
- Monstro com vida 0 fica ☠ CAÍDO e a vez dele é pulada (também no início do combate e na nova rodada); se for curado, volta a agir.
- 🙈 Ocultar / 👁 Revelar aos players: o monstro some da visão dos jogadores e, na vez dele, aparece "algo nas sombras". Atenção: é ocultação de interface; o dado continua no estado compartilhado.
- 🎲 Iniciativa dos monstros: rola 1d20 para cada monstro e reordena.
- Adicionar monstro: monstros já presentes ficam desabilitados; "＋ Cópia" com quantidade (1–20) cria Zumbi 2, Zumbi 3… e já entram no combate.

**Código e testes**
- Novo `src/monsterUtils.js` (funções puras: nomes de cópia, dano/cura, caído, próxima vez).
- Novo `scripts/unit/monster-combat.test.mjs` (6 testes; inclui regressão dos botões do banco).
- Novo `scripts/browser/monster-ui.e2e.mjs` (ponta a ponta com Playwright; ver cabeçalho do arquivo para o uso). Não faz parte do `release:check`.
- Auditoria XSS: 0 novas ocorrências. As 63 conhecidas revisadas por amostragem são números, SVGs/constantes internas ou valores já passados por `esc`/`safeCssImageUrl`; mantidas.

**Pendente**: `npm run build` não rodou neste ambiente (sem acesso ao npm). Rode `npm install` e `npm run release:check` antes de publicar.
