import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GUR — Vite yapılandırması
export default defineConfig({
  plugins: [react()],
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
