import { BUILD_ID } from './version/buildInfo.js';
import '../styles.css';
import '../styles-bloodborne.css';
import './maintenanceAgent.js';

// Configuração opcional. Se VITE_SPOTIFY_CLIENT_ID estiver no .env,
// o botão "Entrar com Spotify" usa esse Client ID automaticamente.
if (import.meta.env.VITE_SPOTIFY_CLIENT_ID) {
  window.SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
}

// O sistema legado é importado como módulo para manter a lógica já testada
// sem reescrever autenticação, Players, fichas e persistência do zero.
import '../app.js';

// BUILD_ID também fica disponível em window.__ASHEN_BUILD_INFO__ no console do navegador.
