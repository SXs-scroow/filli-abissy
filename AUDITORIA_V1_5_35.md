# Ashen Testimony — V1.5.35

## Revisão de manutenção
- Corrigido o teste de segurança de puzzles para validar o comportamento atual: o conteúdo secreto é decodificado pelo parser do desktop antes da renderização, incluindo o estado de corrupção.
- Nenhuma alteração foi feita nos fluxos de autenticação, fichas, persistência ou sincronização do jogo nesta revisão.
- Mantidas as migrações existentes, incluindo a migração de áudio `20261015054816_session_puzzle_audio_20261015.sql`.

## Verificações executadas
- `npm run check`: passou (41 arquivos JavaScript).
- `npm run stability:check`: passou (19 verificações).
- `npm run test:sync`: passou (32 verificações).
- `npm run audit:xss -- --check`: 21 interpolações conhecidas na baseline, 0 novas.
- `npm run test:unit`: passou (93/93).
- `npm run test:maintenance-ai`: passou.
- `npm run test:chaos`: passou (10/10).
- `npm run check:scope`: pulado porque TypeScript não está instalado.
- Build de produção: não validado; a pasta entregue não contém `package-lock.json` e a tentativa de instalar dependências excedeu o limite de execução do ambiente. Execute `npm install` e `npm run build` no ambiente de desenvolvimento antes de publicar.

## Limites
Os testes automatizados não substituem a verificação visual em navegador real. Recomenda-se testar login, boot de 35 segundos, pastas, arquivos corrompidos, reprodução de áudio e persistência em uma sessão de teste antes da publicação.
