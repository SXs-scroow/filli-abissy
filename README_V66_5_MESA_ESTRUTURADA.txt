A PROFECIA V66.5 — MESA ESTRUTURADA

Principais mudanças:
- Mesa refeita com estado de sessão mais previsível.
- Nova sessão cria um novo sessionId, limpa turno, ordem, monstros e histórico e mantém os Players.
- Players são adicionados automaticamente quando entram no Modo Sessão.
- Avançar turno percorre participantes pela ordem definida pelo Mestre e inicia nova rodada ao chegar ao fim.
- Número da ordem é sempre manual; participantes sem número ficam depois dos numerados.
- Pausar/retomar e reiniciar rodada.
- Histórico privado das ações da Mesa.
- ID da sessão visível para diagnóstico.

Validação: app.js passou em node --check. O build Vite não foi executado porque as dependências não estavam instaladas e npm install excedeu o limite de tempo do ambiente.
