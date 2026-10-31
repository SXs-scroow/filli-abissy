# Ashen Testimony V1.5.4 — Câmara do Mestre e mapa interativo

## Alterações
- Corrigidos os botões **Editar** e **Mochila/Bolsa** na tela Fichas dos Players; a tela agora resolve a ficha pelo ID/login estável em vez de depender somente da posição na lista.
- Criado o módulo independente `src/campaignMap.js` para a cartografia fictícia.
- Adicionada a aba **Mapa da campanha** na Câmara do Mestre e a aba **Mapa** para Players.
- O mapa apresenta regiões fictícias, não ruas ou pontos exatos do mapa real de Valinhos.
- O Mestre pode editar nome, descrição e cor de cada região.
- Cada Player pode adicionar marcadores personalizados, alterar nome/cor e remover os próprios marcadores.
- Adicionados estilos do mapa em um bloco próprio no `styles.css`.

## Segurança e persistência
- Nenhuma migração SQL foi adicionada e nenhuma tabela foi apagada ou alterada.
- Os marcadores ficam no registro do Player; as regiões ficam no estado compartilhado da campanha.
- A persistência entre dispositivos depende de a configuração Supabase atual estar funcional e de as políticas existentes permitirem a gravação normal do registro do Player/estado global.
- Nenhum deploy foi executado.

## Verificações executadas
- `node scripts/check-syntax.mjs` — OK.
- `node scripts/stability-audit.mjs` — 17 verificações OK.
- `node scripts/player-sync-regression.mjs` — 27 verificações OK.
- `node --test scripts/unit/*.test.mjs` — 63 testes passaram.
- `node scripts/scope-check.mjs` — pulado automaticamente porque TypeScript não está instalado.
- Build Vite não executado: dependências do projeto não estão instaladas neste ambiente.
