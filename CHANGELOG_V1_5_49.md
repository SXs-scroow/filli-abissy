# V1.5.49

- Protege a fila de sincronização contra persistência de `password`, `newPassword` e `secretLovedEffect`.
- Sanitiza entradas legadas recuperadas do navegador e a fila em memória.
- Adiciona cobertura automatizada para recuperação, integridade do objeto, filas longas e dados sensíveis.
- Reúne testes de persistência, sincronização autenticada e carga virtual no laboratório da aba do Mestre.
- Corrige o resultado do botão de sincronização para não declarar sucesso quando não há sessão, armazenamento remoto, leitura confirmada ou sincronização concluída.
