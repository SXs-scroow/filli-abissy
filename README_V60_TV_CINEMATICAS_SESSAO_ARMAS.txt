A PROFECIA — V60 — Tela da TV, Cinemáticas, Início de Sessão e Dano de Armas

ALTERAÇÕES
- Nova Tela da TV acessível por ?tv=1, sem login.
- Câmara do Mestre > Tela da TV: biblioteca de vídeos, upload local para Supabase Storage, URLs diretas, loop, tela vermelha e tela preta.
- Controle remoto via sincronização global + evento realtime tv-scene.
- Transições suaves e troca de vídeo sem substituir a cena atual antes do próximo vídeo estar pronto.
- A solução não depende de Bluetooth nem de YouTube.
- Roku: o projeto não presume navegador, Chromecast ou controle Roku inexistente. A página funciona em qualquer dispositivo com navegador compatível; em Roku, use um método de espelhamento/reprodução que o modelo realmente ofereça.
- Câmara da sessão: botão Iniciar sessão dispara evento realtime session-start; Players compatíveis executam navigator.vibrate(300), sem bloquear o início.
- Mochila: armas mostram dano. O dano fica na propriedade damage do item e pode ser editado pelo Mestre.
- Itens existentes sem dano recebem valores padrão somente para armas, preservando IDs e demais propriedades.
- Nenhuma função existente foi removida intencionalmente.

OBSERVAÇÃO SOBRE VÍDEOS LOCAIS
Para um arquivo local aparecer em outro dispositivo (inclusive uma tela separada), o Supabase precisa estar configurado, pois o arquivo é enviado ao Storage. Uma URL local/blob de um navegador não é compartilhável entre aparelhos.

OBSERVAÇÃO SOBRE ROKU
Uma aplicação web hospedada não pode criar um navegador ou app Roku automaticamente. A Tela da TV foi preparada como endpoint web separado e usa a rede/Supabase para receber comandos. O espelhamento para Roku continua sujeito ao suporte específico do modelo (por exemplo, AirPlay/Mirroring); o sistema não finge ter suporte que o navegador/Roku não ofereça.
