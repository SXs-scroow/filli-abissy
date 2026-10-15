# Ashen Testimony — V1.5.17 Mesa do Mestre

## Escopo desta revisão
- Ordem de turno manual por participante usando controles de subir/descer; a ordem não depende mais do valor de iniciativa.
- Players continuam sendo incorporados automaticamente à mesa, mantendo suas fichas.
- Novo botão “Nova sessão”, com confirmação explícita, novo identificador de sessão, reinício de rodada/turno/histórico e remoção dos monstros vinculados à sessão anterior. As fichas dos Players são preservadas e reordenadas de forma estável.
- Mantidos o fluxo de iniciar/avançar/encerrar combate e as funções de áudio, pistas e ações rápidas.

## Verificações executadas
- `node scripts/check-syntax.mjs` — passou (34 arquivos).
- `node scripts/stability-audit.mjs` — passou (17 verificações).
- `node scripts/player-sync-regression.mjs` — passou (27 verificações).
- Build de produção não executada neste ambiente: dependências npm não estavam instaladas.

## Teste manual recomendado
1. Entrar como Mestre e abrir a Mesa.
2. Confirmar que todas as fichas de Players aparecem automaticamente.
3. Usar “↑ Ordem” e “↓ Ordem” para definir a sequência e recarregar para confirmar persistência.
4. Iniciar combate e avançar por todos os participantes, verificando a passagem de rodada.
5. Criar uma nova sessão e confirmar que os Players continuam presentes, mas o histórico e os monstros da sessão anterior não.
