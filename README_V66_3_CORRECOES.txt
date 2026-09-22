A PROFECIA — V66.3 (correções + desempenho) — base: V66.2

Mudou só o app.js (e a versão no package.json). Tudo marcado com "V66.3" no código.

1) LOGIN (credenciais)
   - Senha com espaço no fim (teclado do celular costuma acrescentar) passa a entrar: o site tenta também a senha sem espaços nas pontas.
   - Login do Mestre não diferencia maiúsculas/minúsculas ("sxscroow" entra).
   - Conta órfã "Thz": no banco ela NÃO tem senha nenhuma (a senha em texto puro foi apagada por uma gravação de cliente às 21:11 UTC,
     sem que o hash fosse criado). Solução: Câmara do Mestre → Players → Editar (Thz) → campo "Senha" → salvar. O servidor grava o hash.
     (Alternativa: SUPABASE_V66_3_REPARO_THZ_OPCIONAL.sql restaura a senha antiga a partir do histórico. NÃO foi executado.)

2) DESEMPENHO
   - O catálogo de 1.961 itens vem do código; ele estava dentro do estado global (~730–900 KB) e era baixado por todo aparelho ao abrir,
     regravado no navegador a cada alteração e reenviado pelo Mestre a cada salvamento. Agora só itens EDITADOS/CRIADOS são guardados/enviados.
   - Resultado no teste: estado global no servidor 727 KB → 12 KB; estado no navegador 776 KB → ~15–60 KB; tempo de gravação no navegador
     (CPU 4x mais lenta) 1,8 s → 0,2 s.
   - O primeiro Mestre que abrir o site depois da atualização compacta o servidor sozinho (uma vez).

3) SEGURANÇA / BUGS
   - A conta de teste conhecida (teste / Teste1234) não é mais recriada automaticamente a cada abertura. Ela ainda existe no banco:
     apague-a (ou troque a senha) em Câmara do Mestre → Players.
   - Erro esperado de sessão expirada agora aparece como aviso no console, não como erro.

O QUE AINDA DEPENDE DE VOCÊ (não dá para fazer só pelo código)
   - Trocar a senha do Mestre (botão "🔑 Senha do Mestre"): ela ainda é a antiga, que esteve pública.
   - Rodar a Fase 2 do SQL (SUPABASE_V66_2_AUTH_FASE2_...) depois de trocar a senha: fecha a escrita pública nas tabelas e apaga as
     senhas em texto puro do histórico (4.619 linhas ainda as guardam).
   - "Mínima de 18" (ataque/defesa): não ficou claro o que significa; hoje a mínima é 0 (configurável em Limites de criação).
   - Valores assumidos pela V66.2 e ajustáveis: Fratura = 3 de dano; Debilitado = -2 em ataque e defesa.
