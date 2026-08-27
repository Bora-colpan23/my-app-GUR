import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GUR — Vite yapılandırması
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
