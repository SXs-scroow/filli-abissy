# V1.5.78 — Registro de sessão (retrato + mochila única)

- Painel do modo sessão redesenhado: cabeçalho "ASHEN TESTIMONY · REGISTRO DE SESSÃO", retrato de corpo inteiro (arte intacta, `object-fit: contain`), nome em destaque, stats essenciais e mochila.
- Removidos os 6 slots rápidos (mão principal/secundária, consumível, ferramenta, relíquia, livre) e a aba "Mochila" duplicada. `p.sessionSlots` NÃO é apagado dos dados dos players (apenas não é mais exibido).
- A mochila usa o mesmo `p.backpack` e as mesmas regras (peso × quantidade, capacidade, Mochila +8). Funções: selecionar, detalhes (raridade, peso, categoria, dano, propriedades), arrastar e soltar (desktop), botão "Mover" + toque no destino (celular), descartar 1 / tudo (com confirmação). Persistência via `persistPlayerMusicChange` (mesma sincronização Supabase de players).
- Mestre > Símbolos: biblioteca com 38 glifos (runas, selos, olhos, sóis/luas, alquimia, sacrifício, glifos de Ashen), alvos (slot vazio, selo da mochila, canto, divisor, sigilo do retrato), cor dos ornamentos, estilo dos slots, imagem/emoji próprios, prévia antes de aplicar. Salvo em `state.uiIcons.sessionTheme` (grupo incluído em serialização, cache crítico e merge remoto).
- Animações leves (abrir mochila, brilho do slot selecionado, reflexo metálico, entrada/saída de item); respeitam `prefers-reduced-motion`.

- Símbolos editáveis: Mestre cria, edita, renomeia e apaga símbolos próprios (desenho no quadro 24×24, caractere/emoji ou imagem), salvos em `uiIcons.sessionGlyphs` e usáveis em todos os ornamentos.

- Celular: arrastar por pressão longa (toque/caneta) com vibração e rolagem automática, detalhe do item fixo no rodapé, alvos de toque de 44px, retrato compacto ao lado do nome e estatísticas, layout paisagem.

Validação: check, check:scope, stability:check, test:sync, test:player-backup, audit:xss (0 novas), test:unit (201), test:chaos. Visual alinhado aos tokens do modo sessão (--s-*). Build e teste visual em navegador não executados.
