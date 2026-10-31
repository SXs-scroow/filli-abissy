# Ashen Testimony V1.5.62 — correção de cache da entrada

Patch conservador para o problema relatado de o site continuar exibindo uma versão antiga do terminal.

- Marca a versão de entrada como 1.5.62 e altera a URL do módulo de entrada para evitar reaproveitar a referência antiga.
- Adiciona diretivas de não-cache ao HTML e a arquivos JS/CSS não versionados no Vercel.
- Mantém o cache imutável dos assets com hash, que é seguro para arquivos versionados pelo Vite.
- Não altera lógica do terminal, autenticação, Supabase, tabelas, jogadores, dados ou funcionalidades de RPG.

IMPORTANTE: este ZIP corrige a configuração do pacote. Para corrigir o site público, esta versão ainda precisa ser publicada no projeto Vercel que atende o domínio. Não foi possível confirmar um deployment Vercel existente para o projeto informado; portanto não afirmo que o site online já foi atualizado.
