A PROFECIA V39 - CORREÇÃO DE WALLPAPERS GLOBAIS

O que foi corrigido:
- Supabase configurado diretamente em src/supabaseConfig.js como fallback público.
- O projeto não depende mais de .env.example para funcionar no Netlify.
- Wallpaper enviado pelo Mestre é salvo no Storage e a URL pública vai para o estado global.
- Após aplicar um wallpaper, o estado global é enviado imediatamente ao Supabase.
- Realtime continua ativo e foi adicionado fallback de verificação periódica para redes onde Realtime falha.
- Cache-buster nas imagens para impedir aparelhos de continuarem vendo uma versão antiga.
- JPG, JPEG, PNG, WEBP, AVIF e JFIF aceitos.
- SQL atualizado com policies completas para tabela e Storage.

INSTALAÇÃO:
1. Apague o conteúdo antigo da pasta do projeto (ou faça backup).
2. Coloque TODO o conteúdo desta versão diretamente na raiz do projeto.
3. Rode npm install.
4. Rode npm run dev para testar.
5. Execute SUPABASE_GLOBAL.sql no SQL Editor do projeto Supabase.
6. git add .
7. git commit -m "Corrige wallpapers globais"
8. git push origin main

IMPORTANTE:
Não coloque a pasta inteira dentro de outra pasta. app.js, package.json, src, public e styles.css devem ficar diretamente na raiz do repositório.
