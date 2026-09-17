A PROFECIA — V58

Base: V57_FICHA_COMPLETA

Atualizações desta versão:
- Magias na Ficha dos Players agora são clicáveis.
- Depois de escolher a magia inicial, o Player pode clicar em "Usar magia".
- O sistema mostra confirmação com o custo de Sanidade e a Sanidade atual.
- Ao confirmar, desconta automaticamente o custo somente do Player que usou a magia.
- Impede o uso quando a Sanidade atual é menor que o custo.
- O custo numérico das magias existentes é interpretado automaticamente (ex.: "5 Mente" -> 5 Sanidade).
- Adicionada aba "Identidade" na Câmara do Mestre.
- O Mestre pode alterar o nome principal do site (ex.: "Por Slash").
- O Mestre pode enviar uma nova imagem/logo principal; ela aparece no topo e na tela de login.
- Nome e imagem são incluídos na sincronização global quando Supabase está configurado.
- Mantidas as funcionalidades existentes da V57: Ficha completa, dados, mochila, vida, sanidade, perícias, atributos, pontos, condições, classes, Nexus, soundboard, pistas, monstros, fundos, música e demais sistemas.
- Força/dano crítico não foram alterados.

Testes realizados:
- node --check app.js: OK
- node --check src/main.js: OK
- node --check src/globalSync.js: OK
- ZIP test: realizado após empacotamento.
- Build completo do Vite não foi executado porque esta cópia não possui node_modules instalado.
