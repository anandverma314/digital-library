import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { LIBRARY_NAME } from './src/lib/constants';

// The dev server proxies /api to the NestJS backend, so the session cookie is same-origin.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    { name: 'library-name', transformIndexHtml: (html) => html.replaceAll('%LIBRARY_NAME%', LIBRARY_NAME) },
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:4000', changeOrigin: true },
    },
  },
});
