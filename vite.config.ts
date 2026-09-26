import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

// GitHub Pagesのリポジトリ名パスに対応 (BASE_URL環境変数または相対パス)
const base = process.env.BASE_URL || './';

export default defineConfig({
  plugins: [react()],
  root: 'dashboard',
  base: base,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/zod')) {
            return 'vendor-zod';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@domain': path.resolve(import.meta.dirname, './src/domain'),
      '@application': path.resolve(import.meta.dirname, './src/application'),
      '@adapters': path.resolve(import.meta.dirname, './src/adapters'),
      '@frameworks': path.resolve(import.meta.dirname, './src/frameworks'),
    },
  },
  server: {
    port: 3000,
  },
});
