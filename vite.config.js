import { defineConfig } from 'vite';

const buildId = process.env.VERCEL_DEPLOYMENT_ID
  || process.env.VERCEL_GIT_COMMIT_SHA
  || `local-${new Date().toISOString()}`;

export default defineConfig({
  define: { __ASHEN_BUILD_ID__: JSON.stringify(buildId) },
  server: { host: true, port: 5173, strictPort: false },
  preview: { host: true, port: 4173 },
  build: {
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
