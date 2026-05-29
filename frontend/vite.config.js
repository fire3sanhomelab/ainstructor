import { webcrypto } from 'node:crypto'
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    enumerable: true,
    writable: true
  })
}

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/ainstructor/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'AI Instructor',
        short_name: 'AINstructor',
        description: 'AI Language Learning - Cantonese & Mandarin',
        theme_color: '#4F46E5',
        background_color: '#ffffff',
        display: 'standalone',
        scope: process.env.VITE_BASE_PATH || '/ainstructor/',
        start_url: process.env.VITE_BASE_PATH || '/ainstructor/',
        icons: [
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  build: {
    sourcemap: true
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true
      },
      '/ainstructor/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ainstructor/, '')
      },
      '/ws': {
        target: 'ws://localhost:3456',
        ws: true
      },
      '/ainstructor/ws': {
        target: 'ws://localhost:3456',
        ws: true,
        rewrite: (path) => path.replace(/^\/ainstructor/, '')
      }
    }
  }
})
