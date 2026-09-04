# A Profecia V25

## Instalação

```bash
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite.

## Build de produção

```bash
npm run build
npm run preview
```

## Importante sobre Acode no Android

Acode pode editar o projeto normalmente, mas o preview HTML simples não executa um projeto Vite/React. Para rodar o projeto no celular é necessário um ambiente com Node.js/npm (por exemplo Termux) ou abrir o servidor Vite iniciado no computador pela rede local.

O servidor foi configurado com `--host 0.0.0.0`, permitindo acesso por outros dispositivos na mesma rede.

## O que foi corrigido na V25

- versões fixadas e compatíveis de Vite, React e plugin React;
- configuração de servidor para desktop e celular na rede local;
- montagem React simplificada para evitar conflito entre `#root` do sistema legado e o container React;
- carregamento do sistema legado com tratamento de erro visível;
- preservação da lógica existente de login, Players, Mestre, LocalStorage, IndexedDB, fundos, Spotify e fichas;
- nenhuma credencial ou dado existente foi removido.
