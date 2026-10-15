# Ashen Testimony — V1.5.19

## Correções de carga e sincronização
- Corrigidos os personagens artificiais do teste de 20 Players: agora trazem `campaignType`, `Corpo` e `Sanidade` coerentes com o cálculo real dos recursos. A simulação anterior criava fichas sem Corpo; a normalização real calculava Vida máxima igual a 1, gerando erro falso ao comparar a Vida esperada (7) com a Vida calculada (1).
- A falha do teste de carga agora é reportada como falha de simulação/inconsistência, sem abrir o `circuit breaker` nem colocar a sincronização real em modo somente leitura. A simulação usa dados artificiais e não deve interferir nas fichas reais.
- A validação de servidor continua separada: timeout/rede/inexistência de acesso ao Supabase não é reportado como teste aprovado. As 20 chamadas são leituras concorrentes, não uma prova de 20 usuários reais navegando por todas as telas.

## Melhorias do Modo Sessão
- A ordem dos participantes passa por normalização para índices únicos e contínuos, reduzindo colisões antigas de `turnOrder`.
- Mover um participante agora reindexa explicitamente a sequência visível.
- Criar uma sessão usa diretamente o elenco atual de Players, reinicia combate/rodada/turno/ações e cria um novo identificador.
- O histórico anterior e os monstros vinculados ao encontro anterior não são reaproveitados na nova mesa; os cadastros de monstros em si e as fichas de Players não são excluídos.
- O botão de avançar indica quando está iniciando pela ordem em vez de sugerir que já existe um combate ativo.
- Trilha, pistas secretas e Modo Terror ficam sob “Ferramentas auxiliares”, recolhidas por padrão para reduzir a altura da tela principal.
- O aviso de criação/reordenação diferencia estado local de confirmação do servidor quando `saveGlobalNow()` não confirma a gravação remota.

## Validação executada neste ambiente
- `node scripts/check-syntax.mjs` — OK, 34 arquivos JavaScript.
- `node scripts/player-sync-regression.mjs` — OK, 31 verificações.
- `node --test scripts/unit/*.test.mjs` — OK, 67 testes, 0 falhas.
- `node scripts/stability-audit.mjs` — OK, 17 verificações.
- `node scripts/scope-check.mjs` — pulado porque TypeScript não está instalado.
- `npm run build` / `npm run test:chaos` — não concluídos: as dependências npm não estão instaladas e `npm install` não terminou neste ambiente; o teste de caos falha ao importar `@supabase/supabase-js`.

## Limites conhecidos
A correção do erro de Vida está coberta pelo teste isolado com cálculo de Vida derivada. A carga de 20 requisições ainda precisa ser executada com dependências instaladas e autenticação real do Supabase para confirmar a parte de servidor. Não é possível afirmar por este pacote que o backend suporta 20 usuários reais simultâneos sem um teste de carga remoto.
