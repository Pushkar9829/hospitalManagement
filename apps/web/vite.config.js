import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API resolves the hospital from the Host header, so the proxy keeps it (changeOrigin: false).
// Open the app at http://demo.localhost:5173 for the "demo" hospital, and http://localhost:5173
// for the public pricing and signup pages. HMS_API_URL points the proxy at another API.
const api = { target: process.env.HMS_API_URL || 'http://localhost:4000', changeOrigin: false };
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
    // No manual vendor chunk: Rollup splits libraries along the lazy routes, so a screen's
    // libraries (tables, charts, QR) load with that screen. Budget: scripts/initial-js-size.mjs.
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    restoreMocks: true,
  },
});
