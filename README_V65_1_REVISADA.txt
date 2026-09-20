A PROFECIA — V65.1 PATCH REVISADA

Esta versão revisa a V65 + PATCH sem remover os sistemas existentes.

CORREÇÕES PRINCIPAIS
- Players persistidos em tabela própria no Supabase.
- Persistência de Player usa RPC com controle de versão no banco; cliente antigo não pode sobrescrever uma ficha mais nova.
- Removido fallback de upsert direto para Players, pois ele poderia reintroduzir o problema de sobrescrita.
- Cadastro consulta o banco antes de criar login.
- Login consulta o banco antes da cópia local.
- Uma ausência temporária de um Player no retorno de sincronização não encerra a sessão.
- Exclusão de Player via Realtime é confirmada no banco antes de afetar a sessão.
- Realtime de Player não reconstrói a ficha enquanto o Player está digitando.
- Atualizações de outros Players não apagam rascunhos de atributos/perícias.
- Atualizações globais também não reconstruem a ficha de Player automaticamente.
- Atributos e perícias usam o mesmo rascunho e não se apagam ao salvar um dos blocos.
- Rolagens de dados permanecem na ficha e o histórico não some ao rolar novamente.
- Corrigido lookup de condições na ficha.
- Removido bloco duplicado de resumo de progressão na ficha.
- ID de novo Player ganhou componente aleatório para reduzir colisões.
- Assets públicos existentes foram mantidos; nenhum arquivo usado pelo código foi removido.

SUPABASE
1. Execute SUPABASE_V65_PATCH_COMPLETO.sql no SQL Editor.
2. Não apague a tabela a_profecia_global.
3. O SQL cria/migra a_profecia_players, cria histórico e RPC de persistência.
4. O SQL também adiciona as tabelas necessárias ao supabase_realtime.
5. Depois publique este projeto no Netlify.

VALIDAÇÃO LOCAL
- node --check app.js: OK
- node --check src/globalSync.js: OK
- node --check src/playerStore.js: OK
- node --check src/main.js: OK
- npm install/vite build não pôde ser concluído neste ambiente por timeout de instalação/rede; não declarar build Vite validado.


V65.2 - HARDENING MULTIUSUÁRIO (19/09/2026)
- Salvamentos de Player não enviam mais o estado global para o Supabase. Isso evita que dezenas de Players simultâneos sobrescrevam alterações globais do Mestre com estados locais antigos.
- saveGlobalNow() agora aceita escrita global somente para a sessão do Mestre.
- Dados de Player continuam isolados em a_profecia_players e protegidos pelo RPC de timestamp.
- Realtime continua sem reconstruir a ficha do Player enquanto ele edita.
