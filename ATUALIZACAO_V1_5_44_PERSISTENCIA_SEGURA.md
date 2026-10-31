# Ashen Testimony V1.5.44 — persistência defensiva

## Escopo desta etapa

Esta versão inicia o isolamento da camada de persistência sem substituir a lógica de sincronização já existente.

- Adicionado `src/persistence/browserStorage.js` para leitura e gravação JSON defensiva do armazenamento do navegador.
- `src/playerStore.js` usa o módulo para ler e persistir a fila de alterações pendentes dos Players; falhas deixam de ser silenciosas e passam a marcar o estado de sincronização como erro e emitir `a-profecia-storage-error`.
- `src/syncCoordinator.js` usa o mesmo módulo para a fila de snapshots globais e avisa quando a fila não pode ser persistida.
- `src/globalSync.js` usa o módulo para persistir o estado operacional da sincronização.
- Adicionados testes unitários para JSON válido, JSON corrompido, armazenamento bloqueado/quota e remoção.
- Atualizado o carregador de testes de caos para copiar a nova dependência isolada.

## Validação

- `npm run check`: passou (48 arquivos JavaScript).
- `npm run stability:check`: passou (23 verificações).
- `npm run test:sync`: passou (35 verificações).
- `npm run audit:xss`: passou (0 novos achados).
- `npm run test:chaos`: passou (10 testes).
- `npm run test:maintenance-ai`: passou.
- `npm run test:unit`: passou (108 testes).

## Limitação conhecida

O build Vite de produção não foi confirmado neste ambiente: o projeto não inclui `package-lock.json`, `npm ci` não é aplicável e `npm install` excedeu o tempo disponível. Não publicar esta versão até executar a instalação de dependências e `npm run build` com sucesso. Nenhuma alteração foi publicada na Vercel e nenhum dado de produção foi modificado.
