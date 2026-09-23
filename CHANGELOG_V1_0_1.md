# A Profecia — V1.0.1

## Controle de sessão refeito

- Removido o antigo fluxo visual de **Mesa**.
- Removida a dependência do antigo `sessionBoard` para turnos.
- Criado o novo `combatSession`, com estado próprio e persistente.
- O Início do Mestre passou a ser o Centro de Controle da sessão.
- Players entram automaticamente no controlador de combate.
- Iniciativa pode ser definida diretamente nos cards dos Players.
- O botão **Próximo turno** marca automaticamente o participante atual como **JÁ AGIU**.
- O próximo participante recebe a vez imediatamente.
- O histórico registra `X já agiu. Vez de Y.`.
- Ao terminar todos os participantes, a rodada é incrementada e as ações são zeradas.
- Estado do combate é sincronizado pelo Supabase usando `updatedAt`.
- Players recebem indicação de **SUA VEZ / JÁ AGIU / AGUARDANDO**.
- Ficha e modo imersivo usam o novo estado de combate.
- Adição de monstros cadastrados foi integrada ao Centro de Controle.
- Mantidos os controles de trilha, pistas secretas e Modo Terror no Centro de Controle.
- Interface responsiva adicionada para o novo painel.

## Validação

- `node scripts/check-syntax.mjs` passou para os 6 arquivos JavaScript.
- `node --check app.js` passou.
- A sequência lógica foi testada isoladamente com quatro participantes e duas rodadas.
