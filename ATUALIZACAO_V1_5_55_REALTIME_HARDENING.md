# Ashen Testimony V1.5.55 — robustez do canal Realtime compartilhado

## Achado
A implementação anterior adicionava os callbacks de Broadcast depois de `subscribe()` concluir. O teste anterior tratava todos os callbacks locais como se fossem enviados no join do canal, então não detectava a diferença entre o mock e o comportamento documentado do Supabase.

## Correção
- Todos os eventos Broadcast são registrados antes de `channel.subscribe()`.
- O canal compartilhado faz dispatch central para assinantes locais, sem cadastrar um binding remoto duplicado por cada componente/assinante.
- Exceções de um callback são isoladas para não impedir que os demais assinantes recebam o evento.
- Erros/fechamento após uma conexão estabelecida invalidam o canal e agendam reconexão, desde que ainda haja assinantes.
- Teste de regressão confirma que um evento continua chegando depois de uma queda e reconexão simuladas.
- O teste simulado agora congela os bindings do lado do servidor no momento do join, para detectar regressões de registro tardio.
- Mantido o fallback de polling; falha de aviso Realtime não reverte uma gravação confirmada pelo banco.

## Escopo e segurança
- Nenhuma migration SQL foi criada ou executada.
- Nenhum dado de produção foi escrito, modificado ou removido.
- Nenhuma funcionalidade de RPG foi removida.
- O teste E2E de 15 sessões continua restrito a Supabase descartável de homologação.

## Limites
A validação local não substitui `npm run build`, teste em navegador nem execução do E2E contra staging. A compilação continua pendente neste ambiente por falta da dependência `vite` e indisponibilidade anterior do registro npm. Não declarar capacidade real para 15 jogadores até concluir essas etapas.
