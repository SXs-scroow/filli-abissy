# Ashen Testimony V1.5.24 — Mesa dos Players

## Escopo
- Redesign visual da visão compartilhada do Modo Sessão e refinamento dos controles de alternância entre a visão pessoal e o círculo compartilhado.
- Paleta focada em preto, vinho e vermelho sangue, com molduras góticas, contraste e ajustes para telas menores.
- Textos temáticos atualizados sem remover os avisos de privacidade.

## Proteções
- Não foram alterados módulos de autenticação, persistência, Supabase ou sincronização.
- Mantidos os atributos `data-imm-view`, `data-imm-exit` e a função de seleção dos participantes ordenados.
- Não foram alterados contratos de dados ou regras de combate.

## Verificação
Execute no terminal do VS Code:

```powershell
npm run check
npm run test:unit
npm run test:sync
npm run stability:check
npm run audit:xss
npm run build
```

A validação visual final deve ser feita no navegador, tanto em desktop quanto em celular. Testes automatizados não substituem a verificação real de sincronização entre dispositivos.
