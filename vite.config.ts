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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
});
