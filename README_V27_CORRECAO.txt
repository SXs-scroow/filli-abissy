A PROFECIA V27 - CORREÇÃO DE EMERGÊNCIA

Base utilizada: versão antiga V23 enviada pelo usuário, por ser a versão anterior ao conjunto de regressões.

CORREÇÕES:
- Removida declaração duplicada da função spotifyEmbed, que causava SyntaxError e impedia TODO o app.js de carregar.
- Restaurada aba Players na Câmara do Mestre.
- Restaurada aba Classes na Câmara do Mestre.
- Restaurados handlers de Criar, Editar, Mochila e Excluir Players na administração.
- Mantida a Ficha dos Players na aba Ficha.
- Mantido login, sessão, LocalStorage, IndexedDB, Spotify e demais sistemas existentes.

IMPORTANTE:
Esta versão foi validada com: node --check app.js

Teste primeiro esta versão sem misturar arquivos de versões anteriores.
