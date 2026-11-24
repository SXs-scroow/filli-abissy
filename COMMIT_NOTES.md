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

## Ficha do player (V1.5.81)
- **Abas**: Essencial (identidade, vitais, pontos, atributos), Perícias, Dados, Estado e magias, Mochila, História, Ajustes (músicas, wallpaper, alerta de vez). Antes era uma página única de ~12 mil px no celular; Essencial caiu para ~4,8 mil px e perícias têm aba própria. Os cards são os mesmos (só agrupados), então salvar/pontos/mochila seguem iguais. A aba escolhida é lembrada; setas ←/→ trocam de aba; na impressão (PDF) todas as seções aparecem.
- **Barra fixa de vitais** (fica no topo ao rolar): Vida e Sanidade com −1/+1 (reaproveitam o handler existente), condições ativas, 🎲 d20 imediato, 🔁 repetir a última rolagem e o último resultado (toca para abrir o histórico).
- **Revisão de bugs da ficha**: identidade, atributos, perícias, limite de pontos, mochila (adicionar/remover), escolha de classe e notas foram exercitados no navegador; nenhum defeito encontrado nesses fluxos.
- Testes: `scripts/unit/sheet-tabs.test.mjs` (garante que todo card novo da ficha tenha aba); `scripts/browser/sheet-tabs.e2e.mjs` e `scripts/browser/sheet-flows.e2e.mjs` (Playwright, uso no cabeçalho).

## Início do combate (V1.5.82)
- "Iniciar combate" / "Iniciar pela ordem" ignoravam as iniciativas digitadas (começava sempre por quem estava no topo da lista). Agora, ao iniciar, a ordem é reorganizada por iniciativa (maior primeiro; empates mantêm a ordem atual) quando algum participante tem iniciativa diferente de 0. Se todas forem 0, a ordem manual (setas ↑/↓) é preservada.
- Mensagem de lista vazia agora fala em "participante (Player ou monstro)".

## Modo Sessão do Mestre (V1.5.83)
- Novo botão **Sessão** no menu do Mestre: uma tela única, pensada para conduzir a mesa (3 colunas no notebook/tablet, empilhada no celular).
  - **Players**: bolinha online/offline (presença em tempo real), contador "N/M online", Vida e Sanidade com −5/−1/+1 direto no card, condições, iniciativa, Ações rápidas, Ficha, incluir/retirar da sessão.
  - **Combate**: turno atual e próximo, Iniciar/Próximo turno, Iniciativa dos monstros, Ordenar, Rodada, Encerrar; monstros com vida ±, 🎲 Atacar/Dano, Ocultar/Revelar e Remover; histórico e nome/cena da sessão.
  - **Rolagens ao vivo** de todos os players e **ferramentas rápidas**: trilha, pista secreta, puzzles, segredos do Mestre e Modo Terror.
  - Reaproveita os mesmos handlers do Início (nenhuma regra duplicada); as ações de combate agora permanecem na tela em que estiverem (`renderCombatView`).
- **Presença**: Mestre e Players entram no canal `a-profecia-presence-main` (Supabase Realtime Presence, `subscribePlayerPresence` agora aceita `role`). Sem servidor/Realtime, a tela mostra "presença indisponível" e o resto funciona. Não exige migração de banco.
- Atualizações remotas de players, combate, monstros e música re-renderizam a tela Sessão (sem sobrescrever o que o Mestre está digitando).
- Testes: `scripts/unit/session-mode.test.mjs`, `scripts/browser/session-mode.e2e.mjs` (presença simulada pelo evento `ashen-presence-sim`).
- **Não testado com servidor real**: a presença depende do Supabase Realtime; validar em staging com 2+ aparelhos.

## V1.5.78 — Ashen AI Engine
- Added a separate player-facing/session AI engine and authenticated `/api/ashen-ai` endpoint, reusing the project's existing provider environment variables.
- Added bounded session context, archive snippets, conversation history, safe action validation, and explicit confirmation before changing HP/Sanity, initiative, or advancing an active turn.
- Kept maintenance AI isolated from session actions.
- Added unit and API tests for message/context sanitation, action validation, ambiguous targets, provider parsing, and Master-only access.

## V1.6.0 — Ashen AI ampliado

**Motor conversacional e ferramentas**
- Orquestração com chamadas de ferramentas em múltiplas rodadas para provedores OpenAI compatíveis e Anthropic.
- Consultas estruturadas de fichas, monstros, combate, condições, Arquivo, memória, regras e magias.
- Rolagens reais de dados no servidor e testes de perícia/atributo respeitando o modo de rolagem configurado e as perícias somente treinadas.
- Ações ampliadas: condições, inventário, registros no Arquivo e memória, além de Vida/Sanidade, iniciativa e turno.
- Ações propostas podem ser enfileiradas e confirmadas individualmente; nenhuma alteração é aplicada diretamente pelo modelo.

**Memória e voz**
- Nova migração `20261118190000_ashen_ai_memory.sql` cria memória persistente privada com RLS e RPCs que validam o token de Mestre.
- Entrada por voz nativa do navegador com revisão antes do envio; síntese de fala opcional.
- IA de Manutenção continua independente.

**Verificações**
- 22 testes focados de Ashen/migração passaram após a última alteração. O teste de integração da API também passou com a fila de múltiplas propostas. A suíte completa havia reportado 328 testes aprovados antes desse ajuste; a repetição final travou na suíte de estresse sem falha de asserção, portanto o resultado integral final é inconclusivo. A suíte de estresse passou isoladamente (16 testes).
- Integração da API, manutenção, caos, sintaxe, escopo, estabilidade, sync, backup, XSS e secrets passaram.
- Build Vite não validado por ausência de dependências no ambiente; integração real com provedor/Supabase remoto não executada.

**Limites conhecidos**
- PDF/URL de livro de regras não é extraído/indexado para o motor; `search_rules` consulta regras estruturadas e magias enviadas pelo aplicativo.
- Rolagens solicitadas ao motor são mostradas no chat, mas não entram automaticamente no histórico individual da ficha.
- A migração de memória precisa ser aplicada no Supabase do deploy.
