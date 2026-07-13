import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const packagesDir = path.resolve(__dirname, '../packages')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@anime\/(api|auth|constants|utils|hooks|types)(\/.*)?$/,
        replacement: (match, pkg, subpath) => {
          const target = path.resolve(packagesDir, pkg, 'src', (subpath || '').replace(/^\//, ''))
          return target.replace(/\/$/, '')
        },
      },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('Proxy error:', err.message)
          })
        },
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          video: ['hls.js'],
        },
      },
    },
  },
})
