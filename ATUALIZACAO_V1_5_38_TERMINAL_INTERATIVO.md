# V1.5.38 — Terminal interativo e corrupção configurável

## Alterações
- O painel do Mestre agora inclui ações rápidas para criar pastas normais, pastas corrompidas, arquivos e arquivos dentro de pastas.
- Pastas adicionais configuradas no JSON passam a aparecer no terminal do jogador; antes, apenas cinco pastas fixas eram renderizadas, causando a impressão de que pastas novas não eram criadas.
- Pastas e arquivos suportam hierarquia por `parent`, permitindo organizar subpastas e mover itens no terminal.
- O terminal do jogador agora aceita `help`, `ls`, `pwd`, `cd`, `open`, `cat`, `mv` e `clear`. Use aspas para nomes com espaços. `mv item destino` move itens para outra pasta; `mv item /` move para a raiz.
- Os arquivos `LEIA-ME.txt` e `ACESSO.LOG` aceitam conteúdo personalizado por `_readme` e `_log` dentro da configuração de pastas.
- A corrupção pode ser configurada em pastas, arquivos adicionais, LEIA-ME, log e arquivo secreto; mantém os efeitos visuais e o som de corrupção existentes.
- O conteúdo de arquivos adicionais aceita `name`, `content`, `corrupted`, `visibleCharacters` e `parent`.
- Atualização da identificação interna do app para V1.5.38.

## Formatos de configuração

```json
{
  "documents": {
    "title": "Documentos",
    "content": "Texto que o jogador encontra ao abrir a pasta.",
    "corrupted": false,
    "parent": ""
  },
  "arquivo_oculto": {
    "title": "Arquivo oculto",
    "content": "Fragmentos de texto...",
    "corrupted": true,
    "parent": "documents"
  },
  "_readme": {
    "title": "LEIA-ME.txt",
    "content": "Texto escrito pelo Mestre.",
    "corrupted": false
  },
  "_log": {
    "title": "ACESSO.LOG",
    "content": "Registro personalizado.",
    "corrupted": false
  }
}
```

```json
[
  {"name":"registro.txt","content":"Texto do arquivo","corrupted":false,"parent":"documents"},
  {"name":"fragmento.dat","content":"Dados quebrados","corrupted":true,"visibleCharacters":90,"parent":"arquivo_oculto"}
]
```

## Limites e observações
- Até 40 arquivos adicionais por terminal, respeitando o limite total de tamanho do conteúdo codificado no registro do puzzle.
- Os movimentos feitos pelos jogadores são alterações da sessão local do terminal desbloqueado. Não são gravados como uma alteração administrativa permanente no servidor; a estrutura original configurada pelo Mestre permanece salva no puzzle.
- As credenciais e o conteúdo secreto continuam usando os RPCs existentes do servidor.

## Verificações executadas
- `node --check app.js` — OK.
- `node scripts/check-syntax.mjs` — OK (41 arquivos JavaScript).
- `node --test scripts/unit/*.test.mjs` — 93/93 testes aprovados.
- `node scripts/xss-audit.mjs --check` — 0 novos findings.
- `node scripts/stability-audit.mjs` — 19 verificações aprovadas.
- `npm install` excedeu o tempo disponível; portanto, o build Vite ainda não foi executado nesta sessão.
