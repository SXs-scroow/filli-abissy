# Ashen Testimony V1.5.50 — diagnóstico de cache e inicialização

## Objetivo
Dar ao Mestre uma verificação repetível do problema em que um navegador pode continuar vendo uma versão antiga depois de um deploy, sem limpar armazenamento nem alterar a campanha.

## Mudanças
- Novo módulo isolado `src/version/deploymentDiagnostics.js` para diagnóstico de HTML de entrada, cabeçalho Cache-Control, identificação da compilação e controle por service worker.
- Nova seção **4. Inicialização, versão e cache** na Central de Testes da aba do Mestre.
- O botão consulta `/` com `cache: no-store`, `Cache-Control: no-cache` e `Pragma: no-cache`; é uma operação de leitura.
- Mostra release/build ID e cada verificação separadamente, sem esconder resultados parciais.
- Não limpa localStorage, não apaga cache manualmente, não recarrega a página e não escreve dados no servidor.
- Mantém a política Vercel existente: HTML sem cache e arquivos com hash em `/assets/` imutáveis.

## Limitações
- O diagnóstico observa a resposta recebida pelo navegador atual; não prova que todos os jogadores ou todos os pontos de presença da CDN receberam a mesma versão.
- Um resultado positivo deve ser seguido por teste manual após publicar: abrir uma janela privada/dispositivo separado e conferir o build ID.
- O build de produção precisa ser executado no ambiente com dependências instaladas.
