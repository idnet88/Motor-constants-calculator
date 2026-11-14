import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project sites are served below /<repository>/.
const base = process.env.GITHUB_ACTIONS === 'true' ? '/Motor-constants-calculator/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['motor-mark.svg', 'motor-mark-192.png', 'motor-mark-512.png'],
      manifest: {
        name: '모터 상수 계산기',
        short_name: '모터 상수',
        description: '유도기와 동기기 전동기 상수 계산기',
        id: base,
        lang: 'ko',
        theme_color: '#102b31',
        background_color: '#edf2f1',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'motor-mark-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'motor-mark-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
