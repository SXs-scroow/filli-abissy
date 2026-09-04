A PROFECIA — V30

Adições desta versão:
- Trilhas pessoais por Player, com categorias livres (ex.: Música de morte) e título.
- Cards bonitos das trilhas na Home do personagem.
- Wallpaper individual do Player, escolhido por upload e aplicado ao início.
- Migração automática de Players antigos para os novos campos.
- Símbolos continuam centralizados em state.uiIcons, ou seja, uma alteração vale para todos os Players carregados pelo mesmo estado da campanha.

IMPORTANTE SOBRE "GLOBAL PARA TODOS OS DISPOSITIVOS":
A versão atual é frontend/localStorage. Isso significa que, sem um backend, alterações feitas no celular A não chegam magicamente ao celular B.
Para tornar símbolos, Players e demais dados realmente globais para qualquer pessoa que abra o site, o próximo passo é conectar a aplicação a um backend/banco compartilhado (por exemplo Supabase/Firebase ou API própria). Não é seguro fingir que localStorage é sincronização global.
