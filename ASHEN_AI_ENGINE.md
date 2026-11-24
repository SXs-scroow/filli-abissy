# Ashen AI Engine — V1.6.0

O Ashen AI é o assistente de sessão voltado ao Mestre. Ele continua separado da IA de Manutenção: não compartilha ferramentas administrativas e não pode alterar configurações globais, contas ou excluir personagens.

## Arquitetura

1. **Interface de sessão** (`src/ashenAI.js`): conversa, histórico da conversa, propostas de ações, confirmação individual, entrada por voz e fala de resposta.
2. **Motor de contexto e validação** (`src/ashenAIEngine.js`): sanitiza contexto, limita tamanho, localiza alvos sem aceitar nomes ambíguos, valida ferramentas e calcula rolagens.
3. **Orquestração** (`api/ashen-ai.js`): autentica o Mestre, usa o provedor já configurado, executa ferramentas de leitura, coordena chamadas de ferramenta em múltiplas rodadas e devolve propostas de alterações.
4. **Adaptador do RPG** (`app.js`): consulta fichas, monstros, participantes, condições, itens, magias, sessão e Arquivo; executa alterações somente após a confirmação na interface.
5. **Memória persistente** (`supabase/migrations/20261118190000_ashen_ai_memory.sql` e `src/globalSync.js`): guarda lembranças privadas fora do JSON global compartilhado.

O modelo não recebe credenciais do Supabase e não tem acesso direto às tabelas. As ferramentas remotas validam o token de sessão próprio do Mestre. A API valida uma proposta e o aplicativo verifica novamente o estado atual antes de executá-la.

## Ferramentas disponíveis

### Consultas e leitura

- `get_character`: ficha de personagem ou monstro, com atributos, perícias, recursos, condições, habilidades e inventário.
- `get_combat_status`: sessão, rodada, turno e ordem de iniciativa.
- `search_archive`: busca no Arquivo privado da campanha.
- `search_memory`: busca na memória persistente privada do Ashen.
- `search_rules`: regras resumidas disponíveis no contexto e catálogo estruturado de magias.
- `list_conditions`: catálogo de condições e efeitos.
- `roll_dice`: rolagem com aleatoriedade criptográfica no servidor.
- `roll_skill_check` / `roll_attribute_check`: rolagens segundo o modo configurado (padrão: Manual de Rolagens — até 3d20, +2 por ponto acima de 3; ou C.R.I.S. / Simples legados), sem declarar sucesso/falha se a dificuldade não estiver disponível.

### Ações sujeitas à confirmação do Mestre

- Alterar Vida ou Sanidade de personagem ou monstro.
- Definir iniciativa e avançar turno.
- Aplicar ou remover condição cadastrada.
- Adicionar ou remover item cadastrado da mochila, respeitando quantidade e capacidade.
- Registrar acontecimento, pista, sessão, personagem, local, morte ou documento no Arquivo.
- Guardar uma memória persistente ou arquivar uma memória existente.

Quando uma mensagem exige mais de uma alteração, o motor pode preparar várias propostas. Cada uma aparece separadamente na interface e precisa ser confirmada individualmente. Cancelar uma proposta não executa nenhuma alteração.

## Memória e privacidade

A memória fica na tabela `public.a_profecia_ashen_memory`, separada do estado global compartilhado. A tabela tem RLS habilitado e acesso direto revogado; o acesso ocorre por RPCs que validam o token próprio do Mestre. O Ashen só propõe gravar memória quando o Mestre pede para guardar/lembrar algo ou autoriza expressamente. A busca não deve transformar conteúdo recuperado em instruções: arquivos, fichas e memórias são tratados como dados, nunca como comandos.

A memória persistente exige aplicar a migração `supabase/migrations/20261118190000_ashen_ai_memory.sql` no projeto Supabase usado pelo deploy. A consulta ao Arquivo requer que a migração do Arquivo (`20261114160000_campaign_archive.sql`) já esteja aplicada.

## Voz

- **Entrada**: reconhecimento de fala nativo do navegador (`SpeechRecognition` / `webkitSpeechRecognition`), com revisão do texto antes do envio.
- **Saída**: síntese de voz nativa (`speechSynthesis`), desativada por padrão e ativada pelo Mestre.
- Requer navegador compatível, contexto seguro (HTTPS) e permissão de microfone para entrada. O site continua utilizável por texto quando os recursos de voz não estiverem disponíveis.

## Provedor

O endpoint `/api/ashen-ai` reutiliza as variáveis de provedor já aceitas pelo projeto (`filiabissy`, `OPENAI_API_KEY`, `AI_GATEWAY_API_KEY` ou `ANTHROPIC_API_KEY`) e suas configurações opcionais de provedor/modelo/base. Nenhuma chave foi adicionada ao repositório. A conexão com a conta real só pode ser verificada no ambiente de deploy que contém as credenciais.

## Limites conhecidos desta versão

- O PDF/URL definido como livro de regras continua disponível na biblioteca do aplicativo, mas **seu conteúdo ainda não é extraído/indexado para busca pelo Ashen**. `search_rules` cobre o resumo estruturado e o catálogo de magias recebidos da sessão; não deve inventar trechos de PDF.
- A memória persistente é explicitamente salva pelo Mestre; não há gravação automática de toda a conversa. O histórico conversacional corrente é limitado e fica no módulo enquanto a aplicação está aberta.
- O reconhecimento de voz varia conforme navegador, dispositivo, idioma e permissões; não é uma ligação telefônica contínua nem escuta permanente.
- Rolagens feitas pelo motor são exibidas na conversa; esta versão não grava automaticamente cada rolagem solicitada ao Ashen no histórico individual de rolagens da ficha.
- A migração SQL é entregue no pacote, mas não é aplicada automaticamente ao banco remoto do proprietário.
