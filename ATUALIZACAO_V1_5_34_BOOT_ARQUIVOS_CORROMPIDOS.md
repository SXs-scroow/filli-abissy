# Ashen Testimony V1.5.34 — Boot e arquivos editáveis

- Sequência de boot estendida para aproximadamente 35 segundos.
- A frase “a heresia é o caminho” aparece brevemente perto do final da inicialização.
- O editor de terminais agora aceita conteúdo JSON para as pastas Documentos, Registros, Evidências e Sistema.
- O editor aceita até 12 arquivos adicionais, com nome, conteúdo e opção `corrupted: true`.
- Arquivos marcados como corrompidos exibem conteúdo parcialmente ilegível e um ruído sintético temporário. O som pode ser substituído numa revisão posterior.
- A configuração é armazenada junto ao conteúdo secreto já persistido pelo RPC de puzzles; não exige uma nova migração de banco.
- A duração do boot pode ser reduzida se o Mestre fechar ou sair do terminal; o timeout é de 35 segundos.
