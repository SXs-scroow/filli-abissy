# V1.5.78 — Registro de sessão (retrato + mochila única)

- Painel do modo sessão redesenhado: cabeçalho "ASHEN TESTIMONY · REGISTRO DE SESSÃO", retrato de corpo inteiro (arte intacta, `object-fit: contain`), nome em destaque, stats essenciais e mochila.
- Removidos os 6 slots rápidos (mão principal/secundária, consumível, ferramenta, relíquia, livre) e a aba "Mochila" duplicada. `p.sessionSlots` NÃO é apagado dos dados dos players (apenas não é mais exibido).
- A mochila usa o mesmo `p.backpack` e as mesmas regras (peso × quantidade, capacidade, Mochila +8). Funções: selecionar, detalhes (raridade, peso, categoria, dano, propriedades), arrastar e soltar (desktop), botão "Mover" + toque no destino (celular), descartar 1 / tudo (com confirmação). Persistência via `persistPlayerMusicChange` (mesma sincronização Supabase de players).
- Mestre > Símbolos: biblioteca com 38 glifos (runas, selos, olhos, sóis/luas, alquimia, sacrifício, glifos de Ashen), alvos (slot vazio, selo da mochila, canto, divisor, sigilo do retrato), cor dos ornamentos, estilo dos slots, imagem/emoji próprios, prévia antes de aplicar. Salvo em `state.uiIcons.sessionTheme` (grupo incluído em serialização, cache crítico e merge remoto).
- Animações leves (abrir mochila, brilho do slot selecionado, reflexo metálico, entrada/saída de item); respeitam `prefers-reduced-motion`.

- Símbolos editáveis: Mestre cria, edita, renomeia e apaga símbolos próprios (desenho no quadro 24×24, caractere/emoji ou imagem), salvos em `uiIcons.sessionGlyphs` e usáveis em todos os ornamentos.

- Celular: arrastar por pressão longa (toque/caneta) com vibração e rolagem automática, detalhe do item fixo no rodapé, alvos de toque de 44px, retrato compacto ao lado do nome e estatísticas, layout paisagem.

Validação: check, check:scope, stability:check, test:sync, test:player-backup, audit:xss (0 novas), test:unit (201), test:chaos. Visual alinhado aos tokens do modo sessão (--s-*). Build e teste visual em navegador não executados.

## Polimento geral (bugs e usabilidade)
- BUG: fallback de imagem quebrada usava `onerror=` inline, bloqueado pelo CSP (nunca disparava). Agora é um listener delegado (retratos caem em `/ritual.webp`, miniaturas/logo são ocultadas).
- BUG (celular): `100vh` → `100dvh` (barra do navegador do celular cobria o fim das telas).
- Acessibilidade: link "Pular para o conteúdo", foco visível consistente (vários componentes removiam o contorno), `alt` em imagens, suporte a `prefers-reduced-motion` global.
- Toque: alvos de 44px em botões/abas/inputs em telas de toque; abas com encaixe suave; janelas sem "vazar" rolagem para a página de trás.
- Visual: barras de rolagem discretas, seleção de texto e feedback de pressão no tom do site. Novo arquivo `styles-polish.css` (carregado por último, só complementa).

## V1.5.79 — Quadro de investigação (referências do usuário)
- Dossiê em papel envelhecido com polaroide presa por fita (retrato + nome em letra manuscrita), campos de ficha (Vida/Sanidade em barras, Ataque/Defesa) e determinação com controles.
- Carimbos vermelhos (REGISTRO DE SESSÃO, MOCHILA), fio vermelho como divisor, mochila numa bandeja escura; itens com fita, seleção com pino vermelho; detalhe do item como bilhete de papel.
- Menu em ícones redondos; no celular vira barra fixa embaixo (com área segura) e o dossiê fica compacto (polaroide à esquerda, campos à direita).
- Tudo em CSS (sem novas imagens); ornamentos/símbolos continuam personalizáveis pelo Mestre (cores adaptadas a papel e a fundo escuro).
