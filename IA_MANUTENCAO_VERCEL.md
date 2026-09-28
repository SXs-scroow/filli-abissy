# IA de Manutenção — Vercel

A IA usa a Vercel Function `api/maintenance-ai.js`, exposta em `/api/maintenance-ai`.
Só o Mestre logado consegue chamar (a sessão é validada pelo RPC `a_profecia_whoami`).

## Variável de ambiente (Vercel → Settings → Environment Variables)

A função procura, nesta ordem, a primeira que existir. A variável `filiabissy` (nome exato, minúsculo) tem prioridade: o provedor é detectado pelo prefixo da chave (`sk-ant-` = Claude, `vck_` = Vercel AI Gateway, o resto = OpenAI). Para forçar, crie `AI_PROVIDER` com `openai`, `gateway` ou `anthropic`.

| Variável | Provedor | Modelo padrão | Para trocar |
|---|---|---|---|
| `OPENAI_API_KEY` | OpenAI | `gpt-5-mini` | `OPENAI_MODEL`, `OPENAI_BASE_URL` |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway | `openai/gpt-5-mini` | `AI_GATEWAY_MODEL` |
| `ANTHROPIC_API_KEY` | Claude (Anthropic) | `claude-sonnet-5` | `ANTHROPIC_MODEL` |

Marque os ambientes em que a variável vale (Production/Preview) e **faça um novo deploy** depois de criar ou alterar.

## Correções desta versão

- `vercel.json`: removido `"runtime": "nodejs20.x"`, valor inválido nesse campo que derrubava o deploy. A versão do Node agora vem de `engines` no `package.json` (`22.x`).
- Removido `temperature` da chamada: modelos `gpt-5*` retornam erro 400 com valores diferentes do padrão.
- Limite de saída subiu de 1200 para 4000 tokens: em modelos de raciocínio, parte do limite é gasta pensando e a resposta vinha vazia.
- `OPENAI_BASE_URL` com ou sem `/v1` no final funciona (antes gerava `/v1/v1`).
- Suporte a `ANTHROPIC_API_KEY`.
- A conversa enviada ao provedor sempre começa com mensagem do usuário.

## Teste local

```bash
npm run test:maintenance-ai
```
