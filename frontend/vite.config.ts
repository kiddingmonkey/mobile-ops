import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://10.211.79.100:8090'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Mobile-Ops',
          short_name: 'MobileOps',
          description: '手机运维小助手',
          theme_color: '#1F2329',
          background_color: '#1F2329',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        },
        workbox: {
          // 只 precache 静态资源，不缓存 HTML
          globPatterns: ['**/*.{js,css,ico,png,svg,woff2,webmanifest}'],
          navigateFallback: null,
          // 让 SW 立即接管
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            // HTML 页面：网络优先，缓存兜底
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 }
              }
            },
            // API 网络优先
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            antd: ['antd-mobile', 'antd-mobile-icons']
          }
        }
      }
    }
  }
})
