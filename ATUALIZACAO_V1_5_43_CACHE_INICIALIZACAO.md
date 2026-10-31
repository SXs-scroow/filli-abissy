# Ashen Testimony V1.5.43 — Inicialização e cache

## Escopo desta primeira etapa
- Removidos identificadores manuais e fixos de cache (`?v=1541` e `?build=1541`) dos pontos de entrada. O Vite pode controlar a saída de produção por meio dos nomes de arquivos com hash.
- HTML da raiz e `/index.html` configurados para não serem armazenados em cache, reduzindo a chance de um navegador reutilizar uma página de entrada antiga.
- Adicionado identificador de compilação, preferindo `VERCEL_DEPLOYMENT_ID` e usando o SHA do commit como alternativa. O marcador fica disponível em `window.__ASHEN_BUILD_INFO__` para diagnóstico.
- Atualizado o rótulo visível da versão para V1.5.43.
- Adicionado teste automatizado para as regras de cache e os pontos de entrada.

## Importante
Esta alteração trata a camada de inicialização/publicação. Ela não confirma, por si só, que os problemas de persistência ou sincronização com o Supabase foram corrigidos. Esses módulos serão investigados separadamente, preservando dados locais e remotos.
