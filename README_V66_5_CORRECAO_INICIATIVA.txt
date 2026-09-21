A PROFECIA — V66.5 (Correção: não dava pra adicionar Players na iniciativa)

Só app.js mudou.

------------------------------------------------------------------------------
O BUG
------------------------------------------------------------------------------
Na Mesa do Mestre, o combo "Adicionar Player/Monstro..." + botão "+ Adicionar"
às vezes parava de funcionar sem nenhum erro ou aviso.

Causa: a tela da Mesa se reconstrói sozinha toda vez que chega uma
sincronização em segundo plano (um Player mexendo na própria ficha, rolando
dado, mudando vida etc. — algo que acontece o tempo todo numa sessão ao
vivo). Essa reconstrução não guardava o que estava selecionado no combo, então
ele voltava para "Adicionar Player/Monstro..." (vazio) bem no meio da sua
escolha. Se isso acontecesse entre você escolher o nome e clicar em
"+ Adicionar", o clique não fazia nada, porque para o código nenhum
Player/Monstro estava selecionado.

------------------------------------------------------------------------------
A CORREÇÃO
------------------------------------------------------------------------------
Agora, quando uma dessas reconstruções em segundo plano acontece, o valor que
estava selecionado no combo é guardado antes e devolvido ao combo depois — a
tela se atualiza (mostrando as mudanças dos Players) sem apagar a sua escolha
pendente.

COMO INSTALAR
Substitua o app.js do seu projeto por este e publique.
