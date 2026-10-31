# Ashen Testimony V1.5.35 — otimização conservadora de assets

## Objetivo
Reduzir bytes transferidos no carregamento sem alterar interface, lógica de jogo, autenticação, permissões, sincronização, banco de dados ou formatos persistidos.

## Alterações realizadas
- Reotimização sem perdas dos PNGs elegíveis (`optimize=True`, compressão máxima).
- Reempacotamento dos JPEGs elegíveis como progressivos, preservando a qualidade JPEG existente (`quality='keep'`, `subsampling='keep'`).
- Foram alterados 12 arquivos de imagem em `public/`.
- Economia total nesses arquivos: **7.242 bytes** (214.683 → 207.441 bytes, aproximadamente 3,37%). A economia é modesta e refere-se apenas aos 12 arquivos alterados, não ao tamanho total do aplicativo.
- Comparação automatizada dos pixels decodificados e dimensões dos assets JPG/PNG originais e otimizados: sem diferenças detectadas.

## O que foi preservado
- Nenhuma alteração em `app.js`, `src/`, `styles.css`, `index.html`, configuração de Vite, API, SQL/migrações ou configurações de segurança.
- Não houve alteração nos fluxos de autenticação, dados secretos, RPCs, persistência ou sincronização em tempo real.
- As imagens mantêm as mesmas dimensões e pixels decodificados.

## Testes executados após a otimização
- `node scripts/check-syntax.mjs`: aprovado (43 arquivos JavaScript).
- `node scripts/stability-audit.mjs`: aprovado (19 verificações).
- `node scripts/player-sync-regression.mjs`: aprovado (32 verificações).
- `node scripts/xss-audit.mjs --check`: 21 ocorrências conhecidas, 0 novas.
- `node --test scripts/unit/*.test.mjs`: 96/96 aprovados.
- `node scripts/test-maintenance-ai.mjs`: aprovado.
- `node --test scripts/chaos/network-chaos.test.mjs`: 10/10 aprovados.
- `npm run check:scope`: não validado porque TypeScript não está instalado; o próprio script informa que pula essa verificação.

## Limitações
- O build de produção do Vite não pôde ser validado neste ambiente: o ZIP não inclui `package-lock.json`; `npm ci` não pode funcionar sem lockfile e `npm install` excedeu o tempo disponível. Nenhuma dependência ou lockfile foi adicionada ao pacote.
- Não foi possível medir FPS, RAM ou tempo real de carregamento em navegador. Esta entrega é uma otimização conservadora de assets estáticos, não uma alegação de melhoria medida de runtime.
- Para ganhos maiores em JavaScript/CSS, recomenda-se profiling no navegador e benchmark do build de produção antes de mudanças de comportamento.
