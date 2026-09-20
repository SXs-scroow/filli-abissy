A PROFECIA V65.6 — ESTABILIDADE E PERSISTÊNCIA

Alterações desta versão:
- Histórico de rolagens recebe IDs únicos e é mesclado por ID para evitar duplicação/perda em atualizações Realtime.
- Rolagens antigas recebem IDs automaticamente na normalização.
- Atualizações remotas de uma ficha preservam rolagens locais que ainda não estejam no servidor.
- Realtime da ficha continua desacoplado da renderização completa da ficha do Player, evitando apagar campos que estejam sendo digitados.
- Uploads do Supabase Storage usam cache-control de longo prazo; a aplicação continua usando cache-buster na URL quando um arquivo é substituído.
- Uploads só alteram a ficha depois que o arquivo remoto foi enviado com sucesso.
- O código usa Web Crypto para IDs de rolagem quando disponível.
- Não foi alterada a estrutura visual/navegação do site.

Validação realizada:
- node --check em app.js, src/globalSync.js e src/playerStore.js: OK.
- O build Vite não pôde ser executado neste ambiente porque a instalação de dependências npm não terminou dentro do limite de execução; isso é uma limitação do ambiente de validação, não um erro de sintaxe encontrado no projeto.

IMPORTANTE:
A estabilidade real multiusuário depende também das configurações do projeto Supabase. O SQL de persistência/realtime que já acompanha o projeto continua sendo necessário.
