/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Для GitHub Pages сборка идёт с BASE_PATH=/<имя-репозитория>/
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: { port: 5173, host: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
});
