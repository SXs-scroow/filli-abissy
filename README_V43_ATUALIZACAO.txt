A PROFECIA — V43

Principais alterações:
- Pontos de Atributos e Perícias funcionam como saldo consumível; ao chegar a 0, não é possível distribuir mais.
- O Mestre pode conceder pontos extras de Atributo e de Perícia por Player.
- Dados aceitam expressões como d10+6, 2d6 e 1d20-2.
- Mochila ID 89 adiciona +8 espaços: 10 -> 18 enquanto estiver no inventário.
- Player possui anotações privadas; Mestre possui anotações separadas por Player.
- Livros podem receber conteúdo e ser lidos diretamente pela mochila.
- Nova aba Conteúdo no Mestre para cadastrar atributos, perícias, condições, Deuses do Ocultista e magias sem novo commit.
- Ocultista começa com Afinidade e escolhe um Deus cadastrado pelo Mestre; depois a escolha desaparece e o símbolo aparece abaixo da Alma.
- Tela de login recebeu moldura gótica vermelha e ornamento de caveira inspirados nas referências enviadas.
- Dados novos são armazenados no estado global JSONB existente; não é necessária uma tabela nova no Supabase.

Instalação: npm install && npm run dev
