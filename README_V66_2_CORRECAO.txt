A PROFECIA — V66.2 (correção da V66.1)

O QUE ESTAVA QUEBRADO (achado pelo print do console)
1) "Cannot access 'DET_DEFAULT_MAX' before initialization": constantes novas do Modo Sessão estavam declaradas depois do ponto em que o site
   carrega o estado salvo. Com estado salvo no navegador, load() falhava e o site abria com o ESTADO PADRÃO (só o player "teste").
   Consequências que você viu: só dava para pôr 1 player na Mesa, e o Modo Sessão/fichas ficavam inconsistentes.
   → declarações movidas para o topo do app.js. Reproduzi o erro com um estado salvo realista e confirmei a correção.
2) HTTP 400 em a_profecia_push_global (no banco: "SESSAO_INVALIDA"): o site restaurava uma sessão de Mestre antiga (de antes da V66), sem o
   token novo, e tentava gravar. → sessão sem token válido agora cai direto no login, e sem token o site nem tenta gravar.
3) Proteções novas: se load() falhar de novo por qualquer motivo, o que estava salvo é copiado para uma chave de backup
   (filii_abyssi_state_v15_backup_loadfail) e o site não reenvia nada ao servidor a partir do estado padrão.

CONFERIDO NO BANCO: o estado global (main) está íntegro (1.961 itens, nome do site e configurações preservados).

COMO INSTALAR: substitua o projeto por este e publique. Se o navegador ainda mostrar o erro, faça Ctrl+Shift+R (recarregar sem cache) e entre de novo.
