# Ashen Testimony V1.5.63 — correção da criação de vídeo (cinemáticas da TV)

- upload-asset: `.ogg` enviado como `video/ogg` era rejeitado (415); `.m4v` e `.ogv` nem eram aceitos, embora o seletor os oferecesse. Corrigido; em `tv/` o `.ogg` vale como vídeo.
- upload-asset: `upload_failed` agora devolve o motivo real do Storage (`detail`).
- globalSync.uploadGlobalFile: lê o corpo do erro da função e mostra mensagem clara em português em vez de "non-2xx status code".
- app.js (saveTvScene): valida extensão do vídeo e exige URL http(s) antes de enviar.

REIMPLANTAR a função: `supabase functions deploy upload-asset`.
Atenção: limite de arquivo do bucket `a-profecia-assets` (Supabase Storage) e memória da Edge Function podem ficar abaixo de 200 MB.

## V1.5.64 — Restyle estilo Bloodborne UI
Camada final em `styles-bloodborne.css` (seção "V1.5.64") + fontes Spectral/Cormorant Garamond no `index.html`: fundo azul-petróleo, menu lateral em lista, abas com filete, painéis de 1px com brilho frio, dourado envelhecido no item ativo, interruptores e barras finas, tela de entrada sem caixa.
