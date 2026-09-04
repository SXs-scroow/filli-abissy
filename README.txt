A PROFECIA — atualização

Alterações desta versão:
- Nome do site/interface: A Profecia.
- Mantido o visual gótico vermelho/preto com símbolos dourados.
- Vida máxima continua limitada a 35.
- Mochila agora usa 10 ESPAÇOS por peso: peso 1 = 1 espaço, peso 2 = 2 espaços, peso 3 = 3 espaços por unidade.
- O Mestre pode editar o peso de cada item de 1 a 3.
- Ícones enviados para armas, itens-chave, comida e livros foram incorporados ao banco de itens.
- Banco inicial substituído por itens próprios, incluindo armas de fogo e itens inspirados em Fear & Hunger; itens RPG genéricos antigos são migrados/removidos quando eram itens automáticos.
- Expansão temática adicionada: 1.900 itens novos inventados a partir de deuses, locais, cultos, estética, armas e conceitos de Fear & Hunger, sem substituir os itens personalizados existentes. Com os 60 itens próprios já presentes, o banco padrão passa de 1.900 itens e a migração mantém itens customizados do navegador.
- Ficha ganhou: Alma, Imagem da Alma, Objetos Queridos, Personalidade e Destino.
- Novo sistema de Sons: o Mestre pode guardar arquivos de áudio no navegador (IndexedDB) ou URLs e tocar a qualquer momento.
- Caixa de Sons flutuante fica disponível ao Mestre em todas as telas.
- Trilha global é separada dos Sons e fica fora da navegação para continuar ao trocar de tela.
- Trilha global aceita áudio direto e links do Spotify por embed.

Spotify:
O site consegue incorporar links do tipo https://open.spotify.com/track/... ou playlist/album. A reprodução automática pode ser bloqueada pelo navegador/Spotify; nesse caso, basta apertar play no player. O Spotify não fornece um arquivo de áudio que o site possa reproduzir diretamente.

Credenciais existentes são preservadas quando a versão antiga estiver salva no navegador; a migração também preserva itens que aparentem ter sido personalizados.

ATUALIZAÇÃO VISUAL / SPOTIFY
- Reforma visual aplicada sem remover as funcionalidades existentes.
- Pergaminho ornamental usado somente nas fichas.
- Players podem editar a própria ficha, atributos (0-8), perícias (0-15), identidade, textos, retrato, alma e mochila.
- Corpo x 9 define Vida máxima, limitado a 35.
- Sanidade x 9 define Sanidade máxima, limitado a 35.
- Condições e seus ícones existentes foram preservados.
- Rolagem continua sendo 1d20.
- Música global e sons rápidos continuam separados.

SPOTIFY
1. Crie um aplicativo em https://developer.spotify.com/dashboard/.
2. Copie o Client ID para a área Mestre > Trilha global > Spotify.
3. Cadastre no app do Spotify a Redirect URI mostrada pelo site (exatamente igual).
4. Clique em "Entrar com Spotify" e autorize as permissões.
5. Para reprodução completa no navegador, o Spotify exige uma conta Premium compatível com o Web Playback SDK.
6. O site usa OAuth PKCE e não pede nem armazena sua senha do Spotify.


ATUALIZAÇÃO VISUAL E DE FICHA — v14
- Home reformulada com composição inspirada na referência enviada; fundo geral usa fundo-geral.jpg.
- Aba Classes reformulada com estética de grimório e escolha de classe diretamente pelos cards.
- Ao escolher uma classe, a ficha registra a escolha e exibe “Seu destino está selado”.
- Bônus de classe são mostrados automaticamente e considerados nos valores efetivos, respeitando os limites 8/15.
- Vida e Sanidade máximas continuam limitadas a 35 e são derivadas dos atributos correspondentes, sem exibir “×9” na interface.
- Players podem distribuir atributos até 8 e perícias até 15.
- Mestre ganhou aba Símbolos para alterar os ícones de atributos e perícias.
- Mestre ganhou aba Magias para enviar/remover imagens das magias iniciais.
- Mago Amarelo, Ocultista e Sacerdote exibem a área de Magias/Ritual; o Player escolhe apenas uma magia inicial.
- Ficha mantém o pergaminho como aparência principal, com o fundo geral aplicado de forma muito discreta.
- A persistência dos Players permanece no armazenamento local do site. Em uma aplicação puramente estática, isso significa persistência no navegador/dispositivo; para sincronizar a mesma lista entre dispositivos seria necessário um banco/servidor.

V15 — Ficha, classes e observador
- Players agora ficam reunidos na navegação Ficha quando o usuário é Mestre; a aba Players foi removida da Câmara do Mestre.
- Classe é uma escolha única com confirmação. Depois de selada, o Player não pode trocar.
- Valores manuais de atributos continuam limitados a 8; bônus de classe são adicionados separadamente e podem elevar o valor efetivo acima de 8.
- A capa ornamental fica no início da ficha; o restante usa o fundo escuro de caveiras.


- O olho central acompanha o ponteiro/toque.
- A mensagem “O céu aguarda aqueles que vivem pela profecia” continua sendo enviada em código Morse após 45 segundos de inatividade na ficha.
- Cache dos arquivos atualizado para v16.
