# Ashen Testimony V1.4.6

## Novo nome
O site agora se chama **Ashen Testimony** (título da aba, login, topo, aviso de terror, PDF/ficha impressa,
player do Spotify, mensagens e IA de manutenção). Se o Mestre ainda tinha o nome antigo "A Profecia" salvo
em Identidade do site, ele é exibido automaticamente como "Ashen Testimony". Nomes internos (tabelas e funções
`a_profecia_*`, chaves do navegador) NÃO mudaram de propósito, para não quebrar o banco nem fichas salvas.

## Pontos dos Players que sumiam
Causa: a sincronização usava um único carimbo de horário para a ficha inteira. Se o Mestre (ou outro aparelho)
gravasse a ficha com uma cópia antiga, ou o carimbo do servidor fosse mais novo, o salvamento dos pontos era
descartado em silêncio e depois o servidor sobrescrevia o aparelho do Player. Além disso, a atualização remota
trocava o objeto da ficha, e o botão "Salvar" de uma tela aberta gravava numa cópia que já não estava no estado.

Correção:
- Atributos e perícias ganharam carimbo próprio (`_pointsAt`); vence quem tiver os pontos mais novos.
- Servidor (`supabase/migrations/20261005120000_player_points_protect.sql`, já aplicada no projeto): cópia antiga
  não sobrescreve pontos mais novos e um salvamento com pontos novos não é mais descartado.
- Cliente: a ficha é atualizada no mesmo objeto, e pontos locais mais novos são reenviados.
- Teste novo: `scripts/unit/points-protect.test.mjs`.

# V1.4.7 — histórico no servidor e proteção por campo
- **Histórico no servidor:** tabela separada `a_profecia_player_history`, preenchida por gatilho do banco a cada gravação
  da ficha (junta rajadas de 10 s). Guarda tudo nas últimas 24 h, depois 1 por hora até 14 dias e 1 por dia. É apagado
  quando o Player é excluído. Só o Mestre lê/restaura (RPCs `a_profecia_player_history_list/get`); a tabela não tem acesso direto.
- **Tela do Mestre:** botão "Histórico" em cada Player → lista de versões → "Só pontos" ou "Ficha inteira".
- **Proteção por campo:** cada campo (vida, notas, mochila…) tem carimbo próprio em `_keyAt`; o servidor e o site
  mantêm o campo mais novo, mesmo quando o carimbo geral da ficha é mais antigo.
- Migração: `supabase/migrations/20261005140000_player_history_and_field_merge.sql` (já aplicada no projeto).

# V1.4.8 — pontos travados ("restam pontos" mas não deixa distribuir)
- A conta de pontos somava TODAS as chaves da ficha, inclusive atributos/perícias que não aparecem mais na tela
  (customizados removidos/renomeados). Esses pontos "fantasmas" não podiam ser baixados e travavam o Salvar.
  Agora só contam os campos visíveis.
- O rascunho dos pontos (valores digitados e ainda não salvos) ficava guardado no aparelho para sempre e passava
  por cima dos pontos reais. Agora vale só para o próprio Player, por 30 min, e cai se o Mestre/servidor mudar os pontos.
- O limite no campo agora desconta o excesso inteiro (antes tirava só 1 por vez).
- Testes novos: scripts/unit/points-allocation.test.mjs
