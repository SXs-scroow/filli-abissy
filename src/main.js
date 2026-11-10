import { BUILD_ID } from './version/buildInfo.js';
import '../styles.css';
import '../styles-bloodborne.css';
import '../styles-session.css';
import '../styles-polish.css';
import './maintenanceAgent.js';

if (import.meta.env.VITE_SPOTIFY_CLIENT_ID) {
  window.SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
}

import '../app.js';

