A PROFECIA V47 — CORREÇÃO DA NAVEGAÇÃO PARA FICHA

Correção focada no botão "Ficha" da navegação principal.

- Botões de navegação agora são explicitamente type="button".
- Clique da navegação usa preventDefault/stopPropagation para evitar interferências.
- O listener é instalado diretamente em cada botão após cada renderização.
- O botão Sair também foi protegido contra comportamento inesperado.
- Nenhuma outra funcionalidade foi alterada nesta versão.

Verificação: app.js passou em node --check.
