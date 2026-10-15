# V1.5.18 — carga, organização visual e cartografia

## Correção do teste de 20 Players
- Cada cliente virtual passa a manter seu próprio snapshot de sincronização durante a simulação. Antes, todos os clientes virtuais compartilhavam `ps.lastSnapshot`, contaminando os resultados uns dos outros e podendo produzir falsos erros.
- As leituras ao servidor continuam concorrentes, com timeout individual de 12 segundos para que o teste termine como inconclusivo em caso de RPC travada.
- Falha de rede/timeout não é tratada como prova de corrupção de dados nem abre o bloqueio de sincronização; inconsistências lógicas continuam sendo reportadas como falha.
- O teste verifica a lógica de sincronização e a consistência de leituras de fichas existentes. Não simula 20 contas autenticadas distintas nem comprova sozinho a capacidade total do Supabase para 20 usuários reais.

## Organização visual
- As ferramentas auxiliares e o diagnóstico de carga ficam recolhidos por padrão.
- A navegação principal do Mestre mantém as áreas mais usadas visíveis e reúne ferramentas secundárias em “Mais ferramentas”. Nenhuma seção foi removida.

## Cartografia
- A área visível do mapa foi ampliada.
- Rótulos das regiões são renderizados por cima das quadras e estradas, em vez de ficarem escondidos sob elas.
- Quadras ficam menos opacas e a malha viária foi ajustada para reduzir o ruído visual.
- O gerador espalha bairros, quadras e vias por uma área maior, com menos quadras para evitar excesso de sobreposição.

## Verificações nesta sessão
- `node scripts/check-syntax.mjs`: passou (34 arquivos JavaScript).
- `node scripts/player-sync-regression.mjs`: passou (27 verificações).
- `node --test scripts/unit/*.test.mjs`: passou (66 testes).
- `npm run test:chaos`: não pôde ser validado neste ambiente porque a instalação das dependências não terminou e `@supabase/supabase-js` não estava disponível. Executar `npm install` e `npm run release:check` localmente antes de publicar.
- Build Vite não foi validado nesta sessão.
