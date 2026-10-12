# Ashen Testimony — Mapa de Valinhos

## O que foi adicionado
- Nova aba **Mapa** para mestre e jogadores.
- Mapa interativo centrado em Valinhos, SP, com base cartográfica do OpenStreetMap.
- Mestre pode ativar **Adicionar local**, clicar no mapa e registrar nome, categoria e descrição.
- Categorias disponíveis: Local, Investigação, Perigo, Sobrenatural, NPC, Missão e Abrigo.
- Lista lateral de marcadores; selecionar um item centraliza o mapa naquele ponto.
- Mestre pode remover marcadores.
- Marcadores são incluídos no estado global da campanha e sincronizados pelo fluxo global existente.
- Nome de pacote atualizado para `ashen-testimony`.

## Importante
- Os marcadores criados neste MVP são públicos para os membros da campanha. Não registrar pistas secretas, endereços residenciais ou dados pessoais. Um futuro sistema de marcadores privados deve usar armazenamento protegido no servidor e permissões próprias, não apenas ocultar elementos da interface.
- O mapa base requer conexão com a internet e carrega tiles do OpenStreetMap via Leaflet 1.9.4, servido pelo CDN unpkg.
- Os dados de marcadores novos são aditivos; não há migração destrutiva nem alteração das tabelas de jogadores.

## Validação executada
- `node scripts/check-syntax.mjs`: passou.
- `node scripts/stability-audit.mjs`: passou.
- `node scripts/xss-audit.mjs --check`: passou sem novas interpolações inseguras.
- `node scripts/player-sync-regression.mjs`: passou.
- `node --test scripts/unit/*.test.mjs`: 63 testes passaram.
- `npm run build`: não executado com sucesso porque o ambiente não tinha Vite instalado e a instalação de dependências excedeu o tempo disponível. Instalar dependências e rodar o build antes de publicar.
