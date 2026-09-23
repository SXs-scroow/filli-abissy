
## V1.0.0 — correções finais de sessão e mídia

- Turno da Mesa agora avança de forma determinística: o Player atual é marcado como **Já agiu**, o próximo Player é definido imediatamente e o histórico registra quem agiu e quem recebeu a vez.
- O Centro de Controle da Sessão passou a ser a tela inicial do Mestre, com turno, Players, trilha, pistas e Modo Terror em um único painel.
- Trilhas pessoais receberam controles explícitos de tocar, pausar, parar e volume; o player de áudio agora existe globalmente na interface.
- Upload de trilhas pessoais grava a entrada na ficha do Player e força sincronização com o banco.
- Trilhas globais agora possuem uma biblioteca persistente no estado global; uma faixa pode ser reutilizada sem novo upload.
- Pistas secretas agora são armazenadas na ficha do Player e continuam disponíveis mesmo se o Player estiver offline no momento do envio.
# A Profecia — V1.0.0

## Estável

- Centralização das leituras de Players no RPC autenticado por sessão customizada.
- Remoção da leitura pública direta de `a_profecia_players`.
- Eventos de alteração de Players via Supabase Realtime Broadcast, evitando expor a ficha inteira no canal.
- Realtime global reorganizado para evitar listeners duplicados e limpar canais quando não houver assinantes.
- RPCs sensíveis mantêm execução restrita ao papel `anon` usado pelo fluxo de autenticação customizado; autorização continua sendo validada pelo token no servidor.
- Versão do pacote atualizada para `1.0.0`.
- Nome da versão exibida no aplicativo atualizado para `V1.0.0 · VERSÃO ESTÁVEL`.

## Verificações realizadas

- `node --check app.js`
- `node --check src/globalSync.js`
- `node --check src/playerStore.js`
- Teste SQL de isolamento: Player autenticado recebe somente a própria ficha.
- Teste SQL de RLS: leitura direta anônima de `a_profecia_players` retorna zero linhas.
- Migration aplicada no projeto Supabase `dupbzjhmpfwycijmubtn`.

## Limitação conhecida da validação local

A instalação limpa de dependências não pôde ser concluída neste ambiente porque o registro npm não estava disponível durante a execução. Portanto, um `vite build` completo precisa ser executado no ambiente de desenvolvimento/deploy antes da publicação definitiva.
