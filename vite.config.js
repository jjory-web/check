import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: { target: 'esnext' },
  // garu-ko loads its WASM and model with new URL(..., import.meta.url).
  // Pre-bundling it in dev mode (npm run dev) moves the module into .vite/deps
  // and breaks those paths: the WASM request returns index.html and Garu fails.
  optimizeDeps: { exclude: ['garu-ko'] },
});
