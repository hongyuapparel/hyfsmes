import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = process.env.VITE_API_TARGET || env.VITE_API_TARGET || 'http://127.0.0.1:3000'

  return {
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('element-plus')) return 'element-plus'
          if (id.includes('@vue') || id.includes('vue-router') || id.includes('pinia') || /node_modules[\\/]vue[\\/]/.test(id)) {
            return 'vue-vendor'
          }
        },
      },
    },
  },
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite proxy error]', err.message)
          })
        },
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  }
})
