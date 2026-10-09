import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API resolves the hospital from the Host header, so the proxy keeps it (changeOrigin: false).
// Open the app at http://demo.localhost:5173 for the "demo" hospital.
const api = { target: 'http://localhost:4000', changeOrigin: false };
const proxy = {
  '/api': api,
  '/socket.io': { ...api, ws: true },
};

export default defineConfig({
  plugins: [react(), ...(process.env.VITEST ? [] : [tailwindcss()])],
  server: { port: 5173, allowedHosts: ['.localhost'], proxy },
  preview: { port: 4173, allowedHosts: ['.localhost'], proxy },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    sourcemap: true,
    rollupOptions: {
      output: {
        // One long-lived vendor chunk so a deploy of app code does not bust the library cache.
        // (Splitting React from the libraries that use it creates circular chunk imports.)
        manualChunks(id) {
          return id.includes('node_modules') ? 'vendor' : undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    restoreMocks: true,
  },
});
