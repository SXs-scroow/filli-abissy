A PROFECIA — V1.1.9 OTIMIZADO

Alterações principais:
- Corrigido vazamento de estilos em refreshMasterPlayersAdminView():
  o caminho rápido agora libera min-height e overflowAnchor antes de retornar.
- Removido scrollTo() redundante durante re-render da aba Mestre, evitando disputa
  entre duas rotinas de restauração de rolagem.
- Mantida toda a lógica de sincronização, autenticação, pistas secretas e regras existente.

Validação:
- Syntax check: OK (22 arquivos JavaScript)
- Testes unitários: 32/32 passando
- Stability audit: 17/17 checks passando
