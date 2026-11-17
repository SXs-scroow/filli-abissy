# Ashen AI — primeira implementação

## Escopo entregue

- Janela própria `ASHEN AI` no dock da Command Desk, visível somente na interface do Mestre.
- Conversa enviada a `POST /api/ashen-ai`.
- Autenticação server-side por token, exigindo role `master` via `a_profecia_whoami`.
- Recuperação de contexto a partir de `a_profecia_campaign_archive_list`, com o token do Mestre.
- Seleção lexical de registros relevantes em `src/ashenAIContext.js`, com limite de registros e caracteres.
- O prompt exige distinção entre fatos, inferências e sugestões e trata o conteúdo do Arquivo como dado não confiável.
- A Ashen AI é somente leitura nesta etapa. Não possui ferramentas de escrita, exclusão ou revelação.
- Conversas ficam apenas em memória da janela e não são persistidas.
- A configuração e a chamada dos provedores foram extraídas para `api/_lib/ai-provider.js`, compartilhada pela Ashen AI e pela IA de manutenção.

## Limitações deliberadas

A memória conectada nesta etapa é apenas o Arquivo de Campanha. Fichas, Players, monstros, pistas fora do Arquivo, notas privadas do Modo Sessão, regras e outros dados estruturados ainda não são enviados ao modelo.

A recuperação atual é lexical, não vetorial. Ela prioriza correspondências em título, tags, local, categoria e conteúdo. Não foi adicionada dependência de embeddings ou banco vetorial.

## Configuração

A Ashen AI reutiliza as variáveis de provedor já aceitas pelo endpoint de manutenção: `OPENAI_API_KEY`, `AI_GATEWAY_API_KEY`, `ANTHROPIC_API_KEY` ou `filiabissy`, com as opções correspondentes de provider/model/base URL.

O Supabase precisa ter a migração `supabase/migrations/20261114160000_campaign_archive.sql` aplicada. Não foi criada migração nova.

## Testes

- `node --test scripts/unit/ashen-ai-context.test.mjs`
- `node scripts/test-ashen-ai.mjs`
- `node scripts/test-maintenance-ai.mjs`
- `npm run test:unit`

## Atualização V1.5.78 — sessão presencial e integridade

- A janela Ashen AI ganhou o modo Assistente de Sessão Presencial, desativado por padrão e iniciado manualmente pelo Mestre.
- O reconhecimento de fala usa SpeechRecognition/Web Speech quando disponível, em `pt-BR`, com captura contínua enquanto o Mestre mantiver o modo ativo.
- Nesta primeira entrega, o reconhecimento operacional é intencionalmente limitado a comandos de perda/recuperação de PV em linguagem natural. Conversas que não correspondem ao padrão são ignoradas; não são enviadas ao modelo.
- Toda alteração de PV gera uma proposta privada com personagem, valor anterior e posterior. A ficha só muda após confirmação explícita do Mestre. Alvos são resolvidos por nome exato; nomes ambíguos ou inexistentes não são executados.
- A gravação é feita pela integração de voz do navegador; o aplicativo não persiste áudio. O navegador/fornecedor de reconhecimento pode processar o áudio conforme sua própria implementação e política.
- A operação confirmada valida novamente o papel de Mestre, a identidade da ficha, o valor atual de PV e o estado somente-leitura da sincronização. A alteração passa pelo fluxo de persistência existente e gera evento de auditoria.
- A Ashen AI agora recebe o snapshot do Guardião da Sessão, o relatório de integridade da campanha e o diagnóstico do Agente de Manutenção. O botão `VERIFICAR INTEGRIDADE` pede à Ashen uma leitura desses dados. A IA não executa reparos.
- A política de permissões do deploy permite microfone apenas na própria origem (`microphone=(self)`).

Limitação desta primeira versão: não há reconhecimento genérico de qualquer frase nem integração por voz para iniciativa, condições, pistas ou outros recursos. Esses comandos devem ser adicionados individualmente com validação e confirmação. A disponibilidade do SpeechRecognition depende do navegador e de HTTPS.

## Próxima etapa

Expandir o Context Engine com adaptadores de leitura para fichas, monstros, pistas/segredos e Modo Sessão, definindo por módulo quais campos são permitidos no contexto da IA. Só depois adicionar ferramentas de escrita com prévia e confirmação explícita do Mestre.
