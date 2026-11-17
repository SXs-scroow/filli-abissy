# Ashen Command Desk — etapa 1

## Objetivo
Introduzir uma camada de janelas independentes para o Mestre sem reescrever o `app.js`, substituir telas existentes ou alterar o modelo de dados da campanha.

## Arquivos
- `src/windowManager.js`: módulo responsável por montar o dock, abrir/fechar/minimizar janelas, arrastar cabeçalhos e persistir preferências visuais locais.
- `src/main.js`: inicializa o gerenciador depois da aplicação principal.
- `styles.css`: identidade visual CRT + arquivo militar + ocultismo e adaptação mobile.
- `scripts/unit/window-manager.test.mjs`: testes puros de validação das preferências e limites de posição.

## Regras de integração
1. O dock só é montado quando `.shell-master` está presente no `#root`.
2. As janelas não armazenam nem modificam estado da campanha.
3. Preferências de janelas usam a chave local `ashen.window-manager.v1` e são opcionais.
4. Atalhos para Sessão, Administração e Nexus reutilizam a navegação já existente (`data-nav`).
5. Arquivo, Investigação, Entidades e partes de Ambiente permanecem identificados como integrações futuras até receberem conectores reais.
6. A camada é observadora da renderização existente; não intercepta sincronização, autenticação ou persistência de campanha.

## Próximas etapas
- Etapa 2: conectar a Central de Comando a dados já existentes, somente leitura inicialmente.
- Etapa 3: criar o registro de eventos da campanha e uma linha do tempo sem duplicar os registros atuais.
- Etapa 4: conectar a IA contextual com recuperação seletiva, separação Mestre/Player e confirmação antes de alterações.
- Etapa 5: integrar investigação, entidades e ambiente sobre os módulos atuais.

## Verificação realizada
- `npm run check`: aprovado.
- `npm run test:unit`: 278 testes aprovados.
- `npm run check:scope`: aprovado.
- `npm run audit:xss`: 63 interpolações conhecidas, nenhuma nova.
- `npm run build`: não executado com sucesso neste ambiente porque as dependências não estão instaladas (`vite: not found`); a tentativa de instalação excedeu o tempo disponível.
