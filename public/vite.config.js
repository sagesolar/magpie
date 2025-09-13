import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  root: './',
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    },
    sourcemap: mode === 'development',
    minify: mode === 'production'
  },
  server: {
    port: 8080,
    host: true,
    open: true
  },
  preview: {
    port: 8080,
    host: true
  },
  define: {
    // Environment variables will be injected here
    __API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL || 'http://localhost:3000'),
    __NODE_ENV__: JSON.stringify(process.env.NODE_ENV || 'development')
  },
  // PWA and service worker handling
  publicDir: './',
  assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf']
}));