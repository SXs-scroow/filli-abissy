# IA de Manutenção — Netlify

A IA de manutenção usa uma Netlify Function em `/api/maintenance-ai`.

## Segurança

- A função aceita somente `POST`.
- Exige um token de sessão válido do Mestre.
- O token é validado pelo RPC `a_profecia_whoami` do Supabase.
- Players, banco e código não são alterados automaticamente pela IA.
- A chave do provedor não fica no navegador.

## AI Gateway

A função usa as variáveis automáticas do Netlify AI Gateway:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`

Não é necessário colocar uma chave no `app.js` ou no ZIP. O AI Gateway fornece essas variáveis às Functions quando o recurso de IA está habilitado para o projeto.

## Deploy

O projeto agora declara explicitamente:

- build: `npm run build`
- publicação: `dist`
- Functions: `netlify/functions`

Depois de publicar esta versão na Netlify, a interface **Câmara do Mestre → Manutenção → Consultar IA** chama `/api/maintenance-ai`.

O AI Gateway exige que o projeto tenha pelo menos um deploy de produção e esteja em um plano com AI Gateway habilitado.
