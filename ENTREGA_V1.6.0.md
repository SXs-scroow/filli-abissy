# Ashen Testimony — V1.6.0 · Ashen AI ampliado

## Entrega

Esta versão amplia o Ashen AI de uma conversa com três ações simples para um motor de sessão com raciocínio por ferramentas, contexto estruturado, memória persistente e permissões controladas.

### Recursos incluídos

- Conversa geral em português com chamadas de ferramentas em múltiplas rodadas.
- Consulta de fichas de personagens e monstros, atributos, perícias, recursos, condições, habilidades e inventário.
- Consulta do estado de combate, rodada, turno e iniciativa.
- Busca no Arquivo de Campanha e na memória persistente privada.
- Busca em regras estruturadas e magias cadastradas.
- Rolagem real de dados no servidor e testes de perícia/atributo respeitando o modo configurado (Manual de Rolagens, C.R.I.S. ou Simples), bônus recebidos pelo contexto e exigência de treinamento.
- Propostas para Vida, Sanidade, iniciativa, avanço de turno, condições, inventário, registros no Arquivo e memória.
- Suporte a várias propostas em uma mesma solicitação, com confirmação individual de cada ação.
- Memória persistente em tabela própria do Supabase, sem misturar dados privados no JSON global.
- Entrada por voz com transcrição revisável e resposta falada opcional.
- Proteções para alvo ambíguo, ferramentas não permitidas, limite de rodadas, tamanho de contexto e instruções hostis dentro de documentos/memórias.
- IA de Manutenção permanece separada do assistente de sessão.

## Ativação necessária no Supabase

1. Abra o projeto Supabase usado pelo site.
2. Entre no **SQL Editor**.
3. Abra `supabase/migrations/20261118190000_ashen_ai_memory.sql` deste pacote.
4. Execute a migração completa.
5. Confirme que a migração do Arquivo de Campanha `supabase/migrations/20261114160000_campaign_archive.sql` também foi aplicada. Se ainda não foi, aplique-a antes de usar busca e gravação no Arquivo.
6. Publique o site com as variáveis de provedor de IA já configuradas no ambiente.

A migração cria somente a tabela privada de memória e suas RPCs. O pacote não acessa nem modifica o banco Supabase remoto.

## Como testar

1. Entre no site como Mestre e abra **Modo Sessão**.
2. Pergunte algo geral sobre a campanha ou consulte um personagem/monstro.
3. Peça uma rolagem, por exemplo: `Role Furtividade de Engel` ou `Role 2d6+3`.
4. Peça uma alteração clara: `Aplique Sangramento em Engel e registre a marca no corredor no Arquivo`.
5. Confira as propostas exibidas. Confirme cada uma separadamente. Sem confirmação, nenhum dado é alterado.
6. Para testar memória, peça explicitamente `Guarde na memória que...`, confirme a ação e depois solicite uma consulta sobre o mesmo fato.
7. Teste voz pelos botões **Falar** e **Voz ligada**, caso o navegador ofereça suporte.

## Verificações executadas

- Testes focados de Ashen AI e migração de memória: 22 passaram após a última alteração.
- O teste de integração da API passou após a última alteração, incluindo duas propostas encadeadas com confirmação pendente.
- A bateria unitária completa chegou a reportar 328 testes aprovados antes do ajuste final de múltiplas propostas. Na repetição posterior, o executor travou na suíte de simulação de estresse sem registrar falha de asserção; por isso, a execução integral final fica inconclusiva. A suíte `stress-simulation.test.mjs` passou isoladamente (16 testes).
- Teste de integração da API: passou, incluindo chamadas de ferramentas, duas propostas sequenciais, rolagem real simulada pela API e busca de memória via RPC simulada.
- `npm run test:maintenance-ai`: passou.
- `npm run test:chaos`: 10 testes passaram.
- `npm run check`: passou (sintaxe dos módulos JS).
- `npm run check:scope`: passou.
- `npm run stability:check`: passou (23 verificações).
- `npm run test:sync`: passou (43 verificações).
- `npm run test:player-backup`: passou.
- `npm run audit:xss`: passou sem novas ocorrências fora da baseline.
- `npm run check:secrets`: passou, sem segredos conhecidos no repositório.

**Build Vite não validado**: as dependências não estavam instaladas neste ambiente e a tentativa de `npm install` excedeu o tempo disponível. Execute `npm install` e `npm run build` no ambiente de desenvolvimento antes de publicar.

**Integração real não validada**: os testes de API usam respostas simuladas; não foi feita chamada com a chave real do provedor nem execução da migração no Supabase remoto.

## Limites conhecidos

- O conteúdo do PDF/URL guardado como livro de regras ainda não é extraído/indexado para busca pelo Ashen. Ele consulta somente o resumo de regras e catálogos estruturados enviados pela aplicação.
- As rolagens do motor aparecem na conversa, mas ainda não são gravadas automaticamente no histórico individual da ficha.
- A entrada/saída de voz depende do suporte do navegador e de permissões; o texto permanece disponível como alternativa.
