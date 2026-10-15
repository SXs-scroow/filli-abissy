# Ashen Testimony V1.5.22 — Lista de participantes do Modo Sessão

## Alterações
- As fichas dos Players continuam sendo descobertas automaticamente pela Mesa do Mestre; criar uma sessão nova gera um `sessionId` novo e reinicializa o estado do encontro, preservando as fichas cadastradas.
- O Mestre agora pode incluir ou retirar um Player do encontro atual com um controle direto no cartão do participante. Isso só altera a participação na sessão; não exclui nem modifica a ficha.
- Players retirados do encontro deixam de participar da ordem de turnos. Se o Player retirado era o turno atual, a sessão escolhe o primeiro participante restante; se não restar ninguém, o combate é pausado.
- Os controles de mover para cima/baixo ficam desabilitados quando o Player não está incluído.
- Os controles existentes de ordem manual e sincronização global foram preservados.

## Verificação
- `node scripts/check-syntax.mjs`
- `node --test scripts/unit/session-roster.test.mjs`
- `node scripts/player-sync-regression.mjs`
- `node --test scripts/unit/*.test.mjs`

A validação local não substitui o teste com vários navegadores reais conectados ao Supabase. Antes de usar em sessão importante, testar inclusão/remoção, nova sessão, ordenação e reconexão em duas ou mais contas.
