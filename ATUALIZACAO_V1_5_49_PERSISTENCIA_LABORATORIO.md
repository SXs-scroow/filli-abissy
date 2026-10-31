# Ashen Testimony V1.5.49 — Persistência segura e central de testes

## O que mudou

- A fila de sincronização agora sanitiza cada item antes de mantê-lo em memória ou serializá-lo.
- Campos sensíveis (`password`, `newPassword` e `secretLovedEffect`) são removidos recursivamente da fila e dos dados-base.
- Filas antigas armazenadas no navegador são sanitizadas durante a recuperação; os campos legítimos da ficha e os carimbos de atualização são preservados.
- A sanitização cria uma cópia e não modifica o objeto da ficha que está sendo editado na aplicação.
- A fila continua sem truncamento silencioso; teste cobre 175 itens.
- A aba **Mestre → Mais ferramentas → Teste de carga** agora reúne:
  1. teste de persistência isolado (não lê nem grava o armazenamento real);
  2. verificação de sincronização real com confirmação explícita, usando a sessão autenticada e informando falhas sem apresentar falso sucesso;
  3. teste de 30 clientes virtuais, com escalas locais de 30/50/100 e até 30 leituras concorrentes autenticadas, sem carga de escrita em massa.

## Testes executados

- Sintaxe JavaScript: 52 arquivos, OK.
- Testes unitários: 124 passaram, 0 falharam.
- Regressão de sincronização: 36 verificações, OK.
- Auditoria de estabilidade: 23 verificações, OK.
- Testes de caos de rede: 10 passaram, 0 falharam.
- Teste de manutenção: PASS.
- Auditoria XSS: 0 ocorrências novas; 21 ocorrências antigas continuam na baseline e não são declaradas corrigidas.
- `scope-check`: pulado porque TypeScript não está instalado; o próprio script informa isso.

## Limitações conhecidas

- Não foi possível concluir `npm install` neste ambiente dentro do limite de execução; o Vite não está disponível. Portanto, o build de produção não foi validado nesta rodada.
- Não foi feito deploy nem teste com dispositivos externos reais.
- O teste de carga remoto faz leituras autenticadas, não simula o ciclo inteiro de 30 pessoas reais usando mapas, áudio, autenticação e escrita concorrente.
- A verificação de sincronização real na central pode enviar alterações locais pendentes ao servidor; a interface avisa e pede confirmação antes de começar.

## Como testar manualmente

1. Instale as dependências e rode `npm run dev`.
2. Entre como Mestre.
3. Abra **Mais ferramentas → Teste de carga**.
4. Clique em **Testar persistência sem dados reais** e confirme 4/4 verificações.
5. Clique em **Verificar sincronização real** somente quando quiser testar a sessão autenticada; confirme o aviso.
6. Clique em **Executar teste de 30 clientes**. O resultado diferencia `PASSOU`, `PARCIAL`, `INCONCLUSIVO` e `FALHOU`.
7. Para validar concorrência real, abra a sessão em vários navegadores/dispositivos independentes e verifique as fichas, desconexão/reconexão e recarga. O teste virtual não substitui essa validação.
