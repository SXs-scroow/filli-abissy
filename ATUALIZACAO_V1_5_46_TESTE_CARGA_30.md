# Ashen Testimony V1.5.46 — Laboratório de carga isolado

## O que mudou
- Criada uma aba própria **Teste de carga** em Câmara do Mestre → Mais ferramentas, separada da lista de fichas.
- A simulação local principal agora usa 30 clientes virtuais e também testa 30, 50 e 100 clientes para verificar convergência do estado.
- A parte opcional de servidor usa até 30 leituras autenticadas concorrentes de fichas existentes, sem gravar, editar ou excluir dados reais.
- O resultado fica disponível em `window.__aProfeciaStressReport` e a interface identifica PASSOU, PARCIAL, INCONCLUSIVO ou FALHOU.
- Atualizado o identificador da versão para V1.5.46.

## Limites importantes
Este teste não garante por si só 30 usuários reais simultâneos: não simula integralmente a atividade de navegador, mapas, áudio, autenticação, gravações simultâneas nem os limites do plano Supabase/Vercel. A parte do servidor executa leituras, não um teste de carga de escrita em produção. Não foi feito deploy.
