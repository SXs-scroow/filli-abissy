# Ashen Testimony V1.5.21 — Preparação para 35 clientes simultâneos

## Alterações
- O polling de reconciliação das fichas usa jitter de ±15% em vez de disparar em intervalos fixos idênticos.
- O polling do estado global também usa jitter de ±15% e agenda a próxima leitura depois de concluir a atual.
- Objetivo: reduzir picos sincronizados de leituras quando muitos aparelhos abrem a mesa juntos.
- Adicionadas verificações de estabilidade para impedir que esses dois mecanismos voltem a intervalos fixos.

## Limites e validação
- Esta alteração reduz o risco de rajadas de consultas, mas não prova capacidade para 35 usuários reais.
- A suíte local testa a lógica de sincronização em estados isolados; não gera 35 navegadores reais nem mede a capacidade da instância Supabase/hospedagem.
- Antes de declarar a meta cumprida, ainda é necessário executar teste de carga em ambiente de homologação com 35 sessões independentes, medir latência/erros e testar edições simultâneas.
- Não exige migração do banco de dados.
