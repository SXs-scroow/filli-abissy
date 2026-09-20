A PROFECIA — V65.3 MULTIUSUÁRIO

OBJETIVO
Versão preparada para a sessão com vários Players conectados simultaneamente, preservando os sistemas existentes.

CORREÇÕES V65.3
- Imagens de magias da Câmara do Mestre agora são enviadas ao Storage do Supabase e a URL é salva no banco imediatamente após a seleção.
- Símbolos de atributos e perícias agora são enviados ao Storage e salvos no banco imediatamente.
- Imagens de condições agora são enviadas ao Storage e salvas no banco imediatamente.
- Imagens de Deuses criados pelo Mestre agora usam Storage + URL no banco.
- Retrato, imagem da alma e wallpaper dos Players também usam Storage quando Supabase está configurado, evitando colocar imagens grandes dentro do JSON da ficha.
- Uploads usam nomes estáveis por entidade, evitando duplicação desnecessária e permitindo substituir uma imagem.
- As imagens compartilhadas deixam de depender do localStorage do navegador do Mestre.
- O bucket a-profecia-assets e suas políticas já são criados pelo SUPABASE_V65_PATCH_COMPLETO.sql. Não há um novo SQL obrigatório para a V65.3.

MULTIUSUÁRIO
- Players permanecem em a_profecia_players.
- Salvamento de Player não grava o estado global.
- RPC de Player mantém proteção por _syncUpdatedAt.
- Realtime não reconstrói a ficha do Player enquanto ele edita.
- Falha transitória de sincronização não deve deslogar o Player.
- O Mestre continua sendo o responsável pelas alterações globais.
\SUPABASE
Os dois SQL novos já usados na V65.2 continuam válidos. Não execute SUPABASE_GLOBAL.sql novamente apenas por causa desta versão.
\VALIDAÇÃO
- node --check app.js: OK
- node --check src/globalSync.js: OK
- node --check src/playerStore.js: OK
- node --check src/main.js: OK
- Build Vite não foi executado neste ambiente porque as dependências não estão instaladas e a instalação anterior apresentou timeout.
