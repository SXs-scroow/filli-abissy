# Ajustes pós-1.6.0

1. **Terminais (puzzles)**: lista do Player atualiza sozinha (a cada 6 s e por aviso ao vivo `puzzles-changed`); botão rápido "Ocultar dos Players / Mostrar aos Players" na Central de Puzzles; salvar/excluir avisa os Players. Requer a migração `20261118090000_session_puzzle_master_visibility.sql`.
2. **Pontos**: o Mestre não é mais bloqueado por `validateAllocation` ao salvar atributos/perícias acima do limite.
3. **Magias**: `castSpell` já permitia uso com Sanidade insuficiente (aviso + consequência narrada pelo Mestre); mantido.

## Sistema de Rolagens (Manual)
- Novo modo padrão **Manual de Rolagens**: 1 ponto = 1d20 (máx. 3d20), maior dado vale, +2 por ponto acima de 3. Vantagem +1 dado / desvantagem −1 dado (mín. 1, máx. 3). 20 natural no maior dado = crítico; todos os dados em 1 = falha crítica.
- Campo opcional **DT** junto de Vantagem/Desvantagem mostra o grau (falha grave, falha, sucesso, elevado, excepcional).
- Nova página **Rolagens** (tutorial com simulador) no menu de players e do Mestre.
- Campanhas existentes migram automaticamente para o novo modo; C.R.I.S. e Simples continuam selecionáveis em Mestre → regras.
- Ashen AI usa o mesmo sistema nas rolagens de perícia/atributo.

## Ajustes seguintes (Nexus, TV e verificação real)
- **Verificação real** (Mestre → aba de testes): botão "Executar verificação completa". Testa navegador, servidor, tabelas/migrações, Realtime entre dois clientes independentes, WebRTC em loopback, STUN, rotas /api, fichas reais e o motor de rolagens real. O que não roda aparece como "não verificado" (nunca como aprovado) e o relatório (.txt) lista "O que precisa ser resolvido / Como corrigir". O teste "sem dados reais" foi removido.
- **Nexus → TV**: a Tela da TV (`?tv=1`) agora recebe a transmissão do Nexus em tela cheia; Players veem pela aba Nexus no celular. Corrigida a corrida em que o espectador ignorava o aviso de início; reconexão automática; qualidade diferente para TV e celulares; TURN opcional (Mestre → Nexus).
- Testes novos: `scripts/unit/site-verification.test.mjs`, `scripts/unit/nexus-tv.test.mjs`.

## V1.6.2 — correções do relatório de testes
- Cache: `no-cache` (e `must-revalidate`/`max-age=0`) agora é aceito em qualquer host; antes só em localhost, e o ambiente de rede local/Vercel dava "VERIFICAR".
- Versão: release do build (V1.5.77) alinhada com o app (V1.6.2).
- Desempenho: a tarefa longa de ~7 s era a caixa `confirm()` do navegador, que trava a página enquanto aberta. Substituída por confirmação não-bloqueante; a simulação de 15–100 clientes agora cede o processador a cada passo.
- Teste de 15 pessoas: o MOTIVO da falha agora fica salvo e aparece no cartão (e no relatório da Verificação real).
- Teste de 15 pessoas (ponta a ponta): gravações com concorrência limitada (4), latência do aviso Realtime medida a partir da confirmação da gravação (não soma o tempo do servidor), e cada falha traz uma DICA de causa. A simulação local foi provada com o normalize() real do app (teste novo `stress-real-normalize`).
