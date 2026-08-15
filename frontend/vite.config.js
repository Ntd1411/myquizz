import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Vitest reuses this config on purpose: the "@" alias and the Vue plugin above
  // apply to tests too, so there is no second place that can drift out of sync.
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    // Specs live in tests/, mirroring the src/ tree they cover.
    include: ['tests/**/*.spec.js'],
    exclude: ['node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,vue}'],
      exclude: ['src/main.js'],
    },
  },
  server: {
    port: 5173,
    // The backend sets HttpOnly cookies. In dev the frontend origin must be listed
    // in the backend FRONTEND_URL / ALLOW_ORIGIN, otherwise CORS will drop credentials.
    strictPort: true,
  },
})
