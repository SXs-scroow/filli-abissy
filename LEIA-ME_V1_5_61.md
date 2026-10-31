# Ashen Testimony V1.5.61

## Requisitos

- Node.js 22.x (ou versão 22 compatível)
- Acesso ao registry npm para instalar dependências

## Instalar e validar

Na pasta que contém `package.json`, execute:

```bash
npm install
npm run release:check
```

O `release:check` roda as verificações de sintaxe e escopo, auditorias de estabilidade/sincronização/segurança, testes unitários, testes de falhas de rede e, no fim, `vite build`.

Para abrir o modo de desenvolvimento:

```bash
npm run dev
```

## Antes de publicar

Não publique se `npm run release:check` terminar com erro. Depois de um build aprovado, teste a prévia no celular e computador, com login de Mestre e jogador, salvamento de ficha, reconexão, pistas secretas, mapa e funções usadas na sessão.

Nenhum script de migração deve ser aplicado automaticamente. Preserve o projeto Supabase de produção e os jogadores existentes. Esta entrega não publicou em produção e não executou migrações.

## Estado desta entrega

As suítes locais listadas em `RELATORIO_Ashen_Testimony_V1_5_61.md` passaram. A compilação final ficou bloqueada neste ambiente pela indisponibilidade de rede do registry npm, portanto ainda precisa de `npm install` e `npm run release:check` bem-sucedidos em ambiente conectado antes de produção.
