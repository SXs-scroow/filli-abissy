# Ashen Testimony — V1.5.59

## O que mudou
- Acabamento global da interface gótica: hierarquia tipográfica, botões, alertas, tabelas, diálogos, fichas e layout de teste mais legíveis em desktop e celular.
- Coalescência de chamadas de leitura idênticas de Players na mesma aba: pedidos simultâneos de roster compartilham uma requisição; pedidos idênticos por IDs também compartilham a requisição em voo.
- Mantida a leitura autenticada pelo Supabase, a fila de gravação existente, os eventos Realtime e os limites de lote de 50 IDs.
- Não foram alteradas tabelas, migrações, credenciais, fichas, Players, dados do Supabase ou configuração de produção.

## Meta de 15 pessoas simultâneas
Esta versão reduz requisições duplicadas no navegador e melhora a interface, mas isso não é prova de capacidade real para 15 usuários. A confirmação exige build completo, teste autenticado de homologação com 15 contas descartáveis, gravações concorrentes controladas, medição de erros/latência e conferência das cotas/limites do projeto Supabase/Vercel. O teste existente de 15 leituras é somente leitura e não equivale a uma sessão real de 15 pessoas.

## Validação executada
A validação deve ser registrada após executar a suíte e o build com dependências instaladas. Nenhuma validação de ponta a ponta contra Supabase foi executada durante esta alteração.
