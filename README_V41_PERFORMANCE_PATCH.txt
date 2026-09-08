A PROFECIA V41 — PATCH DE ESTABILIDADE E PERFORMANCE

Principais correções:
- Player de áudio global agora usa um único objeto Audio durante toda a sessão.
- Não recria nem baixa novamente o áudio a cada renderização.
- preload mudou para metadata para reduzir uso de memória e banda.
- Removido ciclo de renderização recursiva quando autoplay é bloqueado.
- Atualizações globais apenas de música/fundos não reconstruem toda a página.
- Polling do Supabase passou de 4 segundos para 45s no PC e 90s no mobile.
- Polling é suspenso quando a aba está em segundo plano.
- Atualização imediata ao voltar para a aba.
- Atualizações remotas agora mesclam apenas domínios alterados.
- Redução de efeitos GPU caros no mobile (backdrop-filter, filtros e sombras).
- Suporte a prefers-reduced-motion.

IMPORTANTE: o SQL/Supabase existente continua o mesmo. Não é necessário recriar projeto ou bucket.
