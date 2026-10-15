# Ashen Testimony V1.5.28 — continuação da estabilização

## Alterações
- Reduzido o polling do agente de manutenção de 2 s para 10 s para diminuir trabalho periódico em todas as sessões.
- O agente verifica imediatamente ao voltar para a aba, mantendo a atualização do botão de manutenção sem a checagem agressiva constante.
- Atualizado o identificador do módulo principal para invalidar cache do navegador.
- Mantidos os cálculos de Vida da V1.5.27: 18, 24, 27 e +9 por ponto de Corpo a partir de 3, com máximo 65.

## Validação
- Rodar `npm run release:check` no ambiente com dependências instaladas.
- A checagem atual no ambiente de geração não consegue completar `vite build` porque `vite` não está instalado; não considerar o build validado até rodá-lo localmente.
- A migração de puzzles deve ser aplicada no Supabase para validar os terminais reais.
