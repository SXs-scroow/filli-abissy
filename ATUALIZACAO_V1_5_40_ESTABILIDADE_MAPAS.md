# Ashen Testimony V1.5.40 — Proteção de desempenho na importação de mapas

## Alterações
- Mantido o limite de entrada de 10 MiB para mapas PNG/JPG/WebP.
- A imagem é decodificada e otimizada antes de entrar no estado sincronizado da campanha; o tamanho e a resolução são reduzidos quando necessário.
- O mapa otimizado é limitado a aproximadamente 2 MiB em Data URL para evitar que um único mapa infle o JSON global, prejudique o salvamento ou aumente muito a carga de todos os clientes.
- A importação impede duplo processamento do mesmo campo e restaura o controle do formulário após sucesso ou falha.
- Falhas na otimização são exibidas sem substituir o mapa que já estava salvo.
- Atualizada a versão exibida e o cache-busting para 1.5.40.
- Não foram removidos sistemas, funções, tabelas, políticas ou migrações do Supabase.

## Validação executada neste ambiente
- `node --check src/campaignMap.js`: passou.
- `npm run check`: passou.
- `node --test scripts/unit/*.test.mjs`: 100 testes passaram antes da alteração; serão repetidos após a alteração.
- `node scripts/player-sync-regression.mjs`: 32 verificações passaram antes da alteração.
- `node scripts/stability-audit.mjs`: 19 verificações passaram antes da alteração.
- `node --test scripts/chaos/network-chaos.test.mjs`: 10 testes passaram antes da alteração.
- A instalação de dependências excedeu o tempo limite; por isso o build Vite completo e o teste visual em navegador não puderam ser executados neste ambiente.
