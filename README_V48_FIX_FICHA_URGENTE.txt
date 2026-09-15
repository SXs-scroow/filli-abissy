A PROFECIA V48 — FIX URGENTE DA FICHA

Correções:
- Navegação global por delegação de eventos: o botão Ficha continua funcionando após qualquer re-renderização.
- A renderização da ficha do Player possui fallback de recuperação: se algum componente secundário falhar, a ficha ainda abre com Atributos e Perícias editáveis.
- Mantida a validação de pontos e salvamento por jogador.
- Corrigido o cálculo de capacidade da mochila para usar o personagem correto.
- Não foram removidas funcionalidades existentes.

Teste: entrar como Player > clicar Ficha. A página deve abrir; mesmo em caso de falha secundária, o modo de recuperação permite distribuir e salvar pontos.
