import { defineConfig } from 'vite';

export default defineConfig({
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
