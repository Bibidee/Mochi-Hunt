import { defineConfig } from 'vite';

// Vite config for the Mochi Hunt frontend.
// - root stays at this folder; public/ assets are served from /assets/...
// - build emits hashed, minified bundles to dist/
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          engine: [
            './src/game/engine/Game.js',
            './src/game/engine/Renderer.js',
            './src/game/engine/Loop.js',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    // Proxy API calls to the backend so dev is same-origin (no CORS, no env needed).
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    globals: true,
  },
});
