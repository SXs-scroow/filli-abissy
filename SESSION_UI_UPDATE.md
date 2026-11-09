# Atualização da interface do modo sessão

- Removidos os espaços cosméticos de roupa, armadura, joias e insígnias ao redor do retrato.
- Adicionados seis espaços rápidos funcionais: mão principal, mão secundária, consumível, ferramenta, relíquia e espaço livre.
- Cada espaço pode receber um item já existente na mochila ou ser esvaziado. O item continua na mochila; o espaço rápido é apenas um atalho visual.
- O retrato do personagem agora é exibido em formato vertical, sem recorte em diamante, para acomodar ilustrações de corpo inteiro como as referências fornecidas.
- Na aba Mestre > Símbolos, foram adicionados campos para personalizar os seis símbolos dos espaços rápidos.
- As personalizações dos símbolos são incluídas no estado global e no cache crítico existente.

Validação executada: `npm run check`, `npm run check:scope`, `npm run stability:check`, `npm run test:sync`, `npm run test:player-backup`, `npm run audit:xss` e `npm run test:unit`.

A compilação Vite não foi executada neste ambiente; rode `npm run build` no ambiente com as dependências instaladas antes do deploy.
