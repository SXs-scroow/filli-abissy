A PROFECIA — V66.4

REFACTOR COMPLETO DA MESA / MODO SESSÃO

1) A Mesa agora reconcilia automaticamente todos os Players existentes.
2) Entrar no Modo Sessão pelo Player envia um aviso em tempo real ao Mestre; o Player é registrado automaticamente na sessão atual.
3) Players não recebem número automático no modo imersivo.
4) Na Câmara do Mestre, cada participante possui um campo "Número na ordem". O Mestre define 1, 2, 3 etc. Quem ficar sem número permanece no final.
5) "Avançar turno" foi refeito para usar explicitamente o participante atual e a ordem definida pelo Mestre. Se a sessão ainda não estiver ativa, o botão inicia o primeiro turno.
6) "Nova sessão" agora cria um novo sessionId e um novo objeto de sessão, sem reaproveitar a referência da sessão antiga. Os Players existentes são adicionados novamente, sem números.
7) O estado da Mesa não depende mais de uma seleção manual para funcionar.
8) IDs antigos de participantes são normalizados para continuar compatíveis.

VALIDAÇÃO
- app.js: node --check OK
- src/globalSync.js: node --check OK
- O build Vite não foi executado neste ambiente porque o pacote vite não estava instalado e a tentativa de npm install excedeu o limite de tempo.
