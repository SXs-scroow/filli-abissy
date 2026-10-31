# Ashen Testimony V1.5.45 — proteção da fila de persistência dos Players

## O que mudou

- Adicionado `src/persistence/playerQueue.js` com regras puras para reconciliar a fila em memória com a fila persistida.
- `src/playerStore.js` agora preserva uma edição em memória mais recente quando o `localStorage` contém uma cópia antiga do mesmo Player. Isso é especialmente importante quando uma gravação local falha por quota ou bloqueio do navegador.
- Removido o truncamento silencioso da fila em 100 itens. Antes, mais de 100 Players pendentes podiam ficar em memória, mas somente os 100 finais eram gravados; depois de recarregar, os itens mais antigos poderiam desaparecer.
- Se o navegador não permitir salvar uma fila grande, o mecanismo existente emite o aviso de falha de persistência, em vez de descartar intencionalmente itens para caber no limite.
- Atualizada a identificação da versão para V1.5.45.
- Adicionados testes para recuperação, prioridade de edição mais nova, deduplicação e filas acima de 100 itens.

## Limites desta etapa

- Não altera o schema nem as funções RPC do Supabase.
- Não publica nada na Vercel e não modifica dados de produção.
- Não substitui ainda a reconciliação servidor-cliente nem resolve definitivamente conflitos entre dispositivos. Essa é a próxima etapa depois de validar build e testes.
