CORREÇÃO DE WALLPAPERS - V40

Esta versão corrige o envio global de imagens para o Supabase.

FORMATOS ACEITOS:
- JPG / JPEG
- JFIF
- PNG
- WEBP
- AVIF
- GIF

LIMITE: 10 MB por imagem.

IMPORTANTE - OBRIGATÓRIO UMA VEZ:
1. Abra o Supabase do projeto Filii-Abyssi_completo.
2. Vá em SQL Editor.
3. Crie uma New Query.
4. Abra o arquivo SUPABASE_GLOBAL.sql desta pasta.
5. Copie TODO o conteúdo.
6. Cole no SQL Editor e clique em Run.

Isso cria/confirma:
- tabela global;
- bucket a-profecia-assets;
- permissões de leitura e upload;
- permissões de atualização;
- Realtime.

Depois disso, publique normalmente no Netlify.

A correção usa nomes únicos para cada imagem enviada. Isso evita o erro de UPDATE/UPSERT no Storage e evita cache de wallpaper antigo.

Se houver erro novamente, o site agora mostra o motivo real em vez de apenas "Não foi possível salvar este fundo".
