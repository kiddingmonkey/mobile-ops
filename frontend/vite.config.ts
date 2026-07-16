import { defineConfig, loadEnv, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

// build 时在 dist 根生成 version.json,APK 里读取以显示版本号
function versionJsonPlugin(): Plugin {
  return {
    name: 'gen-version-json',
    apply: 'build',
    closeBundle() {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
      let sha = process.env.GITHUB_SHA || ''
      let runNumber = process.env.GITHUB_RUN_NUMBER || ''
      if (!sha) {
        try { sha = execSync('git rev-parse HEAD').toString().trim() } catch {}
      }
      const version = {
        appVersion: pkg.version,               // 1.1.0
        buildSha: sha.slice(0, 8) || 'local',  // 前 8 位
        buildTime: new Date().toISOString(),
        runNumber: runNumber || 'dev'
      }
      const out = path.resolve('dist/version.json')
      fs.writeFileSync(out, JSON.stringify(version, null, 2))
      console.log(`[version] ${version.appVersion}+${version.buildSha} (#${version.runNumber})`)
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://10.211.79.100:8090'

  return {
    plugins: [
      react(),
      versionJsonPlugin(),
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
