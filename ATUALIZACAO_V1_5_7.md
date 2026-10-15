# Ashen Testimony V1.5.7 — evolução do Modo Sessão

## Implementado nesta etapa
- Adicionada alternância entre **Minha tela** e **Mesa compartilhada** no Modo Sessão dos Players.
- A visão pessoal preserva ficha, mochila, diário, notas, perícias, alma e habilidades.
- A visão compartilhada apresenta título/cena, estado da sessão, rodada/turno e participantes da ordem de combate, com status de turno e valores gerais de vida.
- A troca de visão usa a transição de cortina já existente, preservando a identidade visual.
- CSS novo isolado para a alternância e os cartões compartilhados.

## Verificações
- `node scripts/check-syntax.mjs`: aprovado (33 arquivos JavaScript).
- `node scripts/player-sync-regression.mjs`: aprovado (27 verificações).
- `node --test scripts/unit/*.test.mjs`: 65/65 testes aprovados.
- Build Vite: não executado aqui. O projeto não inclui `package-lock.json`, então `npm ci` não é aplicável; `npm install` excedeu o limite desta execução. Rodar `npm install` e `npm run build` no ambiente de desenvolvimento antes de publicar.

## Ainda não declarado como concluído
- A reconstrução completa do painel do Mestre não foi alterada nesta etapa, pois já existe um Centro de Controle do Mestre em `combatMasterHome()`.
- A sincronização independente da V1.5.6 foi preservada, mas requer testes de integração com o Supabase real e múltiplos dispositivos.
- Histórico no Supabase continua dependendo de migrações/RPCs aplicadas no projeto remoto.
