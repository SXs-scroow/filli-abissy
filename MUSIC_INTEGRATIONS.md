# Biblioteca de música — integrações

A biblioteca aceita três origens, detectadas pelo endereço informado:

- **Arquivo / URL direta de áudio:** MP3, MPEG, WAV, OGG, OGA, M4A, AAC, FLAC, OPUS e WEBM. Arquivos enviados são armazenados no Supabase Storage (limite atual de 50 MB). Links diretos precisam apontar para um arquivo de áudio que o navegador consiga reproduzir.
- **Spotify:** links de faixas, álbuns, playlists, artistas, episódios e programas. Links curtos `spotify.link` e `spoti.fi` são resolvidos pelo endpoint `/api/resolve-spotify` antes de serem salvos. O Spotify Web Playback SDK exige configuração do Client ID e HTTPS (ou localhost em desenvolvimento). A reprodução completa no navegador exige Spotify Premium. Cada participante autoriza sua própria conta/dispositivo; a conta do Mestre não transmite o áudio para os demais.
- **YouTube / YouTube Music:** links de vídeo, Shorts, links `youtu.be` e URLs `music.youtube.com`. A aplicação incorpora o player oficial do YouTube (modo de privacidade aprimorada), com controles visíveis. Não extrai nem converte o vídeo em MP3. A reprodução automática pode ser bloqueada pelo navegador, caso em que o participante deve apertar Play no próprio player. O volume local é ajustado no controle do player incorporado.

Páginas genéricas que não sejam um arquivo de áudio ou um link reconhecido de Spotify/YouTube são rejeitadas, em vez de serem tratadas incorretamente como MP3.

## Compatibilidade com dados anteriores

Entradas antigas da biblioteca continuam sendo reconhecidas: links de áudio diretos permanecem como `audio`, e as novas entradas guardam `provider` e `type` para identificar a origem. Nenhuma migração de banco é necessária porque a biblioteca já é persistida como JSON no estado global da campanha.
