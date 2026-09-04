import '../styles.css';

// Configuração opcional. Se VITE_SPOTIFY_CLIENT_ID estiver no .env,
// o botão "Entrar com Spotify" usa esse Client ID automaticamente.
if (import.meta.env.VITE_SPOTIFY_CLIENT_ID) {
  window.SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
}

// O sistema legado é importado como módulo para manter a lógica já testada
// sem reescrever autenticação, Players, fichas e persistência do zero.
import '../app.js';
