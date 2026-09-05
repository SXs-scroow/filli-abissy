A PROFECIA V37 — PLAYERS E WALLPAPERS GLOBAIS

O que mudou:
- Players agora podem ser sincronizados entre computadores/celulares.
- Mestre vê os mesmos Players independentemente de onde fez login.
- Fundos do site podem ser globais.
- Símbolos globais já fazem parte do estado compartilhado.
- Monstros, itens e magias também acompanham o estado global.
- Login/sessão continuam locais para não compartilhar a sessão do Mestre.

ATIVAÇÃO (necessária para global funcionar):
1. Crie um projeto em supabase.com
2. Abra SQL Editor e execute SUPABASE_GLOBAL.sql
3. Copie Project URL e anon key.
4. Crie um arquivo .env na raiz do projeto:
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
5. Rode: npm install
6. Rode: npm run dev
7. Para Netlify, coloque as duas variáveis em Site configuration > Environment variables e faça novo deploy.

IMPORTANTE:
Sem configurar Supabase, o projeto continua funcionando exatamente em modo local.

SEGURANÇA:
O login Mestre/Player atual é frontend/local e não é autenticação de servidor. O SQL está configurado para permitir a sincronização do modelo atual. Se o site for público, a próxima evolução recomendada é migrar autenticação e permissões para Supabase Auth ou backend/Netlify Functions.


V38 - IMPORTANTE: crie um arquivo .env na raiz (ao lado do package.json) com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY reais. O arquivo .env.example não é lido automaticamente. Depois reinicie npm run dev. No Netlify, cadastre as mesmas variáveis em Site configuration > Environment variables e faça novo deploy. Execute novamente SUPABASE_GLOBAL.sql no SQL Editor para habilitar Realtime.
