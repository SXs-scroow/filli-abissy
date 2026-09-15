V46 — correção da abertura da ficha dos Players

Correção específica:
- O botão “Abrir ficha” na área de Players do Mestre agora possui listener diretamente no grid de Players.
- O listener usa o ID do Player e funciona mesmo depois de a lista ser reconstruída.
- Mantido o fallback por índice para registros antigos.
- Nenhuma outra funcionalidade foi removida.

Validação: node --check app.js passou.
