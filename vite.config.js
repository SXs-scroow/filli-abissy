import { defineConfig } from 'vite';

// Vercel fornece um ID por deploy; localmente geramos um ID por compilação.
const buildId = process.env.VERCEL_DEPLOYMENT_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || `local-${new Date().toISOString()}`;

export default defineConfig({
  define: { __ASHEN_BUILD_ID__: JSON.stringify(buildId) },
  server: { host: true, port: 5173, strictPort: false },
  preview: { host: true, port: 4173 },
  build: {
    // Separa a biblioteca de sincronização do código da aplicação. Isso reduz
    // o chunk inicial sem esconder o aviso ou apenas aumentar seu limite.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor';
          if (id.includes('/node_modules/')) return 'vendor';
        }
      }
    }
  }
});
