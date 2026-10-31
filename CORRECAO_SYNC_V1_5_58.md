# Ashen Testimony — correção de sincronização V1.5.58

## Correção aplicada
A função de liderança da fila de Players (`isLeader`) dependia exclusivamente de `localStorage`.
Quando o navegador bloqueava o acesso ou `setItem` falhava, ela retornava `false` e impedia
`flushPlayerQueue()` de enviar alterações pendentes ao Supabase. Isso podia deixar a fila parada
indefinidamente em determinados modos de privacidade ou políticas do navegador.

Agora, usa `getBrowserStorage()`, mantém o lease entre abas quando o armazenamento funciona e
permite o envio local da fila quando o armazenamento está indisponível. Foi adicionado um teste
regressivo estático para esse caso.

## Preservação e limites
- Nenhuma migração SQL foi alterada.
- Nenhum dado ou ficha foi alterado no Supabase.
- Nenhuma funcionalidade foi removida.
- O canal Realtime fixo `a-profecia-players-events` foi preservado.
- Esta correção trata um defeito concreto, mas não prova que todos os problemas de sincronização
  foram eliminados. O teste E2E real em homologação continua necessário.
