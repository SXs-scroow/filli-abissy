import { BUILD_ID } from './version/buildInfo.js';
import '../styles.css';
import '../styles-bloodborne.css';
import '../styles-session.css';
import '../styles-polish.css';

if (import.meta.env.VITE_SPOTIFY_CLIENT_ID) {
  window.SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
}

import '../app.js';

// Recursos de diagnóstico/manutenção não bloqueiam a primeira renderização.
// São carregados quando o navegador termina o trabalho prioritário.
const scheduleIdle = (task) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(task, { timeout: 2500 });
  } else {
    window.setTimeout(task, 1200);
  }
};

scheduleIdle(() => {
  import('./maintenanceAgent.js').catch((error) => {
    console.warn('[Ashen] Não foi possível carregar o agente de manutenção:', error);
  });
});

scheduleIdle(() => {
  import('./performance/performanceDiagnostics.js')
    .then(({ startPerformanceMonitor }) => startPerformanceMonitor())
    .catch((error) => {
      console.warn('[Ashen] Monitor de desempenho indisponível:', error);
    });
});

