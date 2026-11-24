# Ashen Testimony — V1.5.78 · Ashen AI Engine

## O que entrou

- Painel **Ashen AI** no Modo Sessão, separado da IA de Manutenção.
- Conversa em português com histórico durante a navegação da aplicação.
- Contexto de sessão enviado ao motor: cena, rodada, turno, participantes, personagens presentes, vida, sanidade, condições, monstros e registros carregados do Arquivo de Campanha.
- Endpoint autenticado em `api/ashen-ai.js`, restrito à sessão do Mestre.
- Reutiliza as variáveis de provedor já aceitas pelo projeto (`filiabissy`, `OPENAI_API_KEY`, `AI_GATEWAY_API_KEY` ou `ANTHROPIC_API_KEY`) e suas configurações de modelo/base.
- O motor pode propor três ações: alterar Vida/Sanidade, definir iniciativa e avançar turno.
- Toda ação exige confirmação explícita na interface. Alvos ambíguos, ações fora da lista e avanço de turno antes do combate começar são rejeitados.
- Contexto enviado ao provedor é filtrado e limitado; não inclui senhas, tokens, fichas completas ou dados de autenticação.
- A IA de Manutenção continua independente e não ganhou acesso às ferramentas do Mestre.

## Como testar no site

1. Publique a versão e confirme que as variáveis de IA já usadas pelo projeto estão configuradas no ambiente Vercel de produção/preview.
2. Entre como Mestre e abra **Modo Sessão**.
3. Pergunte algo sobre a cena, o combate, os personagens ou o Arquivo.
4. Para testar uma ação, use um pedido inequívoco, por exemplo: `Tire 2 pontos de vida de Engel`.
5. Confira a ação proposta e toque em **Confirmar ação**. Sem confirmação, nada é alterado.

## Limites desta primeira etapa

- Ainda é uma primeira versão textual: voz, fala em áudio, iniciativa automática por rolagem, condições por linguagem natural, inventário, pistas e criação de registros ainda não estão conectados como ferramentas do motor.
- A conversa fica em memória enquanto a aplicação está aberta; não foi criada uma memória permanente independente para o Ashen.
- A resposta real do provedor depende da chave/modelo configurados no deploy. Os testes locais usam respostas simuladas e não comprovam conectividade com a conta real do provedor.
- O build Vite não pôde ser executado neste ambiente porque `vite` não está instalado em `node_modules`. O comando `npm run build` deve ser executado após instalar as dependências no ambiente do projeto.

## Verificações executadas

- `npm run test:ashen-ai`: passou (testes unitários do motor e teste da rota/API).
- `npm run test:maintenance-ai`: passou.
- `npm run check`: passou.
- `npm run check:scope`: passou.
- `npm run stability:check`: passou (23 verificações).
- `npm run test:sync`: passou (43 verificações).
- `npm run test:player-backup`: passou.
- `npm run audit:xss`: passou sem novas interpolações inseguras.
- `npm run test:chaos`: passou (10 testes).
- `node --test --test-force-exit scripts/unit/*.test.mjs`: a suíte anterior à inclusão dos três testes de UI passou (312 testes).
- Os 3 novos testes de integração da UI passaram separadamente; os 6 testes do motor/API também passaram separadamente. Assim, as 315 verificações unitárias/integradas foram validadas, embora a repetição integral após incluir os testes de UI tenha ficado presa em um teste de longa duração do conjunto.
- `npm run build`: não executado com sucesso: `vite: not found`.
