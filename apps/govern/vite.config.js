import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@qre-theme': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../shared/qre-theme'),
      react: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/react'),
      'react-dom': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/react-dom'),
      'lucide-react': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/lucide-react'),
    },
  },
  server: {
    fs: { allow: [path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')] },
    port: 5175,
    host: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  base: '/govern/',
});
