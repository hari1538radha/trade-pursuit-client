import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(import.meta.dirname, 'src/data') } },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
