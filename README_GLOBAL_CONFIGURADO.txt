FILI-ABYSSI — SUPABASE JÁ CONFIGURADO

1. O arquivo .env desta versão já contém o Project URL e a Publishable Key do projeto.
2. Rode: npm install
3. Depois: npm run dev

IMPORTANTE — UMA ÚNICA VEZ NO SUPABASE:
Abra o SQL Editor do projeto Supabase, crie uma nova query, cole TODO o conteúdo de SUPABASE_GLOBAL.sql e clique em Run.
Sem executar esse SQL, o site abre normalmente, mas não consegue sincronizar os dados globais.

NETLIFY:
No painel do site, abra Site configuration > Environment variables e adicione:
VITE_SUPABASE_URL = https://dupbzjhmpfwycijmubtn.supabase.co
VITE_SUPABASE_ANON_KEY = a mesma Publishable Key usada no .env
Depois faça Trigger deploy > Clear cache and deploy site.

O QUE É GLOBAL NESTA VERSÃO:
- Players e fichas
- Monstros
- Itens
- Magias
- Símbolos
- Fundos alterados pelo Mestre
- Wallpapers pessoais dos Players
- Fotos de perfil e alma dos Players

Arquivos de imagem enviados com Supabase configurado vão para o Storage online, portanto outros celulares/computadores conseguem vê-los.
