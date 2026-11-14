# Patch 01 — Concessão direta de magias pelo Mestre

## O que mudou
- Cada ficha na Central de personagens ganhou a ação **✧ Magias**.
- O Mestre pode abrir a lista do grimório existente e marcar/desmarcar magias para aquele Player.
- Magias iniciais da classe e magias pessoais aparecem identificadas e protegidas contra remoção acidental por esta ferramenta.
- As concessões usam o campo já existente `grantedSpells`; não duplicam a definição da magia nem criam cópias no grimório.
- Quando o armazenamento de Players via Supabase está habilitado, a alteração é enviada pelo `upsertPlayers` e só é anunciada como sincronizada após confirmação do servidor.
- Se o armazenamento remoto estiver desabilitado, a interface informa que a alteração ficou apenas neste aparelho.
- Não há migração SQL, alteração de schema, exclusão de Players ou mudança nos dados globais do Supabase.

## Validação executada
- `npm run check`: aprovado (80 arquivos JavaScript).
- `npm run check:scope`: aprovado.
- `npm run stability:check`: aprovado (23 verificações).
- `npm run audit:xss -- --check`: aprovado sem novos findings (63 ocorrências antigas conhecidas).
- `npm run test:sync`: aprovado (43 verificações).
- `npm run test:player-backup`: aprovado.
- Testes específicos da concessão: 4/4 aprovados.
- `npm run test:unit`: 227/233 aprovados; os mesmos 6 testes de rolagem C.R.I.S. falham também na versão original sem este patch, portanto são falhas preexistentes e não relacionadas à concessão de magias.
- `npm run build`: não executado com sucesso porque o ambiente não possui a dependência local `vite` instalada (`vite: not found`).

## Como usar
Câmara do Mestre → Players → ficha do personagem → **✧ Magias** → marcar as magias → **Salvar concessões**.
