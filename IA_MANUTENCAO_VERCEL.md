# IA de Manutenção — Vercel

A IA de manutenção usa a Vercel Function `api/maintenance-ai.js`, exposta em `/api/maintenance-ai`.

## O que foi adaptado

- A rota usa o formato de Serverless Function da Vercel.
- A chave continua exclusivamente no servidor; ela nunca é enviada pelo frontend ao provedor.
- Suporta `OPENAI_API_KEY` diretamente.
- Também suporta `AI_GATEWAY_API_KEY` da Vercel AI Gateway.
- Com `AI_GATEWAY_API_KEY`, o padrão é `https://ai-gateway.vercel.sh/v1` e o modelo `openai/gpt-5-mini`.
- Com `OPENAI_API_KEY`, o padrão é `https://api.openai.com/v1` e o modelo `gpt-5-mini`.
- `OPENAI_BASE_URL` e `OPENAI_MODEL` continuam disponíveis para configuração personalizada.
- `AI_GATEWAY_BASE_URL` e `AI_GATEWAY_MODEL` podem ser usados para configurar o Gateway explicitamente.
- A chamada usa `max_completion_tokens`, compatível com a API atual de Chat Completions.
- A sessão do Mestre continua sendo validada pelo RPC `a_profecia_whoami` antes de chamar a IA.

## Vercel

O arquivo `vercel.json` fixa a Function em Node.js 20 e configura duração máxima de 60 segundos.

As variáveis de ambiente precisam existir no ambiente do deployment. A Vercel aplica variáveis de ambiente por escopo (Production, Preview e Development); depois de alterar uma variável, é necessário fazer um novo deploy para que o deployment receba a alteração.

## Teste local do endpoint

```bash
npm run test:maintenance-ai
```

Esse teste simula a validação da sessão e verifica tanto a configuração OpenAI direta quanto a configuração do Vercel AI Gateway, sem usar uma chave real.
