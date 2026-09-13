import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GUR — Vite yapılandırması
//
// GUR_ARTIFACT=1 ile derlenirse çıktı TEK parça olur. Artifact önizlemesi
// tek bir HTML dosyası olarak yayınlanıyor; ayrı bir chunk yükleyemez.
// Bu bayrak olmadan yönetici paneli React.lazy ile ayrı dosyaya düşer ve
// önizlemede açılmaz.
const SINGLE_FILE = process.env.GUR_ARTIFACT === '1';

export default defineConfig({
  plugins: [react()],
  build: SINGLE_FILE
    ? {
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            manualChunks: undefined,
          },
        },
      }
    : {},
  server: {
    port: 5173,
    open: false,
    // API ayrı portta çalışıyor; /api istekleri oraya geçirilir ki
    // tarayıcı tarafında CORS ve mutlak URL derdi olmasın.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
