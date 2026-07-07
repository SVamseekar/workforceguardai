import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8001'

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/health': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: 'index.html',
          mission: 'mission.html',
          privacy: 'privacy.html',
          terms: 'terms.html',
          disclaimer: 'disclaimer.html',
          refunds: 'refunds.html',
        },
        output: {
          // Vite 8 / Rolldown expects manualChunks as a function, not a static map.
          manualChunks(id) {
            if (id.includes('node_modules/recharts')) return 'charts'
            if (id.includes('node_modules/lucide-react')) return 'icons'
            if (id.includes('node_modules/axios')) return 'network'
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/__tests__/setup.js'],
      globals: true,
      // MSW uses a process-global server; avoid cross-file handler races in CI.
      fileParallelism: false,
      testTimeout: 15_000,
    },
  }
})
