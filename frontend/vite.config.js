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
  server: {
    port: 5173,
    // The backend sets HttpOnly cookies. In dev the frontend origin must be listed
    // in the backend FRONTEND_URL / ALLOW_ORIGIN, otherwise CORS will drop credentials.
    strictPort: true,
  },
})
