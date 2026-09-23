A PROFECIA — V1.0.1
CONTROLE DE SESSÃO REFEITO

O antigo sistema de Mesa/Avançar turno foi retirado da interface e substituído por um controlador de combate novo, integrado ao Início do Mestre.

FLUXO DO COMBATE
1. Todos os Players cadastrados aparecem automaticamente.
2. O Mestre define a iniciativa de cada Player.
3. O sistema ordena por iniciativa maior para menor.
4. O Mestre clica em Iniciar combate ou Próximo turno.
5. Ao passar o turno, o participante atual recebe automaticamente a marca JÁ AGIU.
6. O próximo participante recebe a VEZ imediatamente.
7. O histórico registra quem agiu e quem recebeu a vez.
8. Ao completar a ordem, uma nova rodada começa e as marcas de ação são zeradas.

PERSISTÊNCIA
- O estado é salvo no estado global do Supabase como combatSession.
- Atualizações remotas usam updatedAt para evitar que uma versão antiga substitua uma mudança nova.
- O antigo sessionBoard não é mais usado pelo aplicativo.

CENTRO DE CONTROLE
- Turno atual
- Rodada e contador de turno
- Ordem de iniciativa
- Players com estado visual
- Ações rápidas de ficha
- Adição de monstros cadastrados
- Trilha global
- Pistas secretas
- Modo Terror
- Nome e cena da sessão
- Histórico
