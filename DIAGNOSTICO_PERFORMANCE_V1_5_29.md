# Ashen Testimony V1.5.29 — primeira correção de alocação na renderização

## Diagnóstico estático
- O projeto renderiza a tela principal montando HTML e substituindo `#root.innerHTML`.
- A assinatura usada para deduplicar atualizações remotas era criada concatenando `view + HTML completo + JSON do modo terror + JSON da marca`. Como `app.js` e as telas são grandes, isso cria uma segunda string grande em toda renderização, mesmo quando a deduplicação remota não é necessária.
- A assinatura agora usa tamanho + dois hashes de 32 bits calculados sobre o HTML e os metadados relevantes. Isso evita duplicar o HTML inteiro na memória só para a comparação. A renderização e a sincronização continuam com o mesmo fluxo.
- Isso é uma otimização fundamentada no código, não prova de que seja a única causa nem uma medição de FPS. Para identificar os maiores custos restantes é necessária uma sessão de navegador com Performance/Long Tasks, pois o ambiente de testes não executa o site real num navegador.

## Proteções preservadas
- Não foram modificados autenticação, tokens, permissões, RPCs, tabelas/migrações, formatos de ficha, funções de salvamento ou módulos de sincronização.
- A assinatura é somente uma chave de deduplicação visual, não participa de identidade, autenticação ou persistência.

## Verificações executadas
- `node scripts/check-syntax.mjs`: passou, 41 arquivos JS.
- `node --test scripts/unit/*.test.mjs`: passou, 93/93.
- `node scripts/player-sync-regression.mjs`: passou, 32 verificações.
- `node scripts/stability-audit.mjs`: passou, 19 verificações.
- `node scripts/xss-audit.mjs --check`: 21 ocorrências preexistentes, 0 novas.
- Build Vite e profiling de navegador não foram executados neste ambiente; não declarar esses itens validados.

## Próximo profiling real
No Chrome/Edge, DevTools > Performance, gravar 15–20 s ao abrir o site e navegar entre Home/Ficha/Mesa; procurar Long Tasks e separar tempo de scripting, style/layout e paint. Comparar também um perfil com cache frio e outro com cache quente. Não usar teste de carga de rede como substituto para esse perfil local.
