# Ashen Testimony V1.5.34 — Terminal

## O que mudou
- **Boot**: reescrito no estilo eDEX-UI (log rolando → logo ASHEN OS com glitch → barra → ACESSO CONCEDIDO). Não reinicia mais quando o app re-renderiza; botão PULAR ▸ e botão ↻ no topo para rever.
- **Pastas**: o filesystem agora navega de verdade (Documentos, Registros, Evidências, Gravações, Sistema), com ícones em SVG, caminho, contador, barra de montagem e ícone de aviso em pastas com arquivos corrompidos. O console imprime os comandos (`cd`, `cat`, `play`).
- **Arquivos corrompidos** (editor do Mestre): arquivo principal, arquivos de texto adicionais (até 12, com pasta) e gravações podem ser marcados como corrompidos.
  - Texto: leve (quase legível), grave (fragmentos) ou total (dump ilegível). Botão "Pré-visualizar / sortear de novo".
  - Áudio: "com falhas" (toca distorcido, com dropouts e chiado) ou "ilegível" (não toca).
  - O jogador só recebe a versão corrompida; o original não sai do servidor. Há um botão "fsck" que tenta reparar e falha.
- **Áudio**: motor Web Audio novo (sons de clique, pasta, abrir/fechar, acesso negado/concedido, erro de arquivo corrompido), boot sincronizado com as linhas (camada do `terminal-startup.mp3` + hum, relé, seeks, chime), player próprio com visualizador, e volume/mudo salvos no navegador. A gravação não para mais quando a tela atualiza.

## Para ativar os arquivos corrompidos
Aplique no Supabase: `supabase/migrations/20261015120000_session_puzzle_corrupted_files.sql`
(sem ela o app avisa ao salvar que os arquivos extras/corrompidos não foram gravados).

## Arquivos
`src/terminalKit.js` (novo), `app.js`, `styles.css`, migração acima, `scripts/unit/terminal-kit.test.mjs`.
