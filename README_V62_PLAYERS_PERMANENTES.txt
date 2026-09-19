A PROFECIA V62 — PLAYERS PERMANENTES

Correção principal:
- Players não são mais substituídos por uma lista remota menor durante a sincronização.
- Players são mesclados por ID/login.
- Cada alteração local de Player recebe um timestamp de sincronização.
- Players novos são preservados mesmo quando outro dispositivo possui uma lista antiga.
- Exclusões feitas pelo Mestre usam tombstones de sincronização, evitando que um dispositivo antigo recrie o Player.
- O payload global passa a transportar playerTombstones.
- Atualizações remotas de outros domínios não substituem a lista de Players inteira.
- O backup local da V61 continua ativo.

IMPORTANTE:
A V62 evita a causa de regressão por concorrência/estado antigo no cliente, mas não pode recuperar um Player que já tenha sido apagado definitivamente do banco e de todos os backups.
