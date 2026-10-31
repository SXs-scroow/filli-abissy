# Relatório de validação — Ashen Testimony V1.5.50

## Escopo desta etapa
Diagnóstico de inicialização, cache e identificação da compilação, mantendo a persistência, sincronização e laboratório de carga da V1.5.49.

## Alterações
- Criado `src/version/deploymentDiagnostics.js` para consultar o HTML da origem com `cache: no-store`, validar `Cache-Control`, reconhecer a estrutura do HTML e sinalizar service worker controlador.
- Adicionada a etapa **4. Inicialização, versão e cache** na Central de Testes da aba do Mestre.
- O diagnóstico é somente leitura: não limpa armazenamento, não altera fichas e não recarrega a página.
- Versão atualizada para V1.5.50; identificação de build continua injetada pelo Vite/Vercel.
- Criados testes unitários para respostas corretas, cabeçalhos de cache inadequados, service worker e falhas de rede.

## Resultados executados
- `node scripts/check-syntax.mjs`: PASSOU — 54 arquivos JavaScript.
- `node --test scripts/unit/*.test.mjs`: PASSOU — 129 testes, 0 falhas.
- `node scripts/player-sync-regression.mjs`: PASSOU — 36 verificações.
- `node scripts/stability-audit.mjs`: PASSOU — 23 verificações.
- `node scripts/xss-audit.mjs --check`: 21 ocorrências conhecidas da baseline, 0 novas.
- `node scripts/test-maintenance-ai.mjs`: PASSOU.
- `node --test scripts/chaos/network-chaos.test.mjs`: PASSOU — 10 testes.
- `node scripts/scope-check.mjs`: não executou a verificação TypeScript porque `typescript` não está instalado; o script reportou que pulou essa etapa.

## Pendência de ambiente
`npm install --ignore-scripts --no-audit --no-fund` excedeu o tempo disponível. A tentativa offline também não pôde concluir, pois as dependências não estão no cache local. Por isso, **o build de produção não foi validado neste ambiente**; não declarar esta versão pronta para produção até `npm run build` passar com as dependências instaladas.

## Teste manual recomendado após o build/publicação
1. Mestre > Mais ferramentas > Teste de carga.
2. Executar os testes de persistência e sincronização já existentes.
3. Executar **Verificar versão e cache**; revisar cada item e o build ID exibido.
4. Abrir o mesmo deploy em janela privada ou outro dispositivo e comparar o build ID.
5. Executar o teste de clientes virtuais de 30 (e escalas locais de 50/100) e tratar leituras remotas como diagnóstico de leitura, não como prova definitiva de 30 usuários completos.
