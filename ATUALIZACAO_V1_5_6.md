# Ashen Testimony V1.5.6 — base de estabilidade

## Incluído nesta etapa
- Novo `src/syncCoordinator.js`: coordenação única das gravações globais, snapshot pendente local e retry quando a conexão volta. O snapshot só é removido da fila após confirmação do `pushGlobal`.
- O salvamento automático e os salvamentos explícitos passam pela mesma fila para reduzir disputas entre dois mecanismos de gravação.
- Novo `src/mapGenerator.js`: geração procedural de mapa urbano com distritos contíguos, eixos viários, anéis, ruas secundárias e quadras. Referências com termos como porto, costa, ilha, rio ou lago podem influenciar o cenário aquático; não há cópia de ruas reais.
- Configuração do Vite separa chunks de dependências (`supabase-vendor` e `vendor`) em vez de simplesmente elevar o limite do aviso.
- Testes unitários para consistência do gerador cartográfico.

## Verificações executadas
- `node scripts/check-syntax.mjs`: passou (33 arquivos).
- `node scripts/player-sync-regression.mjs`: passou (27 verificações).
- `node --test scripts/unit/map-generator.test.mjs`: 2/2 testes aprovados.
- Build de produção: **não executado neste ambiente**. A instalação das dependências excedeu o limite de tempo disponível; executar `npm install` e `npm run build` no notebook antes de publicar.

## Limites e próximos passos
- Uma fila local protege alterações pendentes, mas não é garantia matemática de ausência de perda: o armazenamento local pode ser limpo, ficar sem espaço ou o servidor pode rejeitar a escrita. Manter backups locais e remotos e observar o estado de sincronização.
- O histórico de Players depende da migração `20261005140000_player_history_and_field_merge.sql` e das RPCs de histórico no Supabase. Esta versão não declara o histórico corrigido sem validar a migração no projeto remoto.
- O redesenho visual completo do Modo Sessão continua como próxima etapa, após validar a base de sincronização e os arquivos no build local.
