import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import 'antd-mobile/es/global'
import { applyTheme, useTheme } from './store'
import { loadBuiltinVersion } from './utils/version'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

const CURRENT_VERSION_KEY = 'mobile_ops_dist_version'
const WEBROOT_DIR = 'webroot'

/**
 * 在 App 渲染前尝试切换到 OTA 新版本
 * 这是唯一能让 setServerBasePath 生效且不死锁的时机
 *
 * 通过对比 fetch 到的 version.json 判断是否已经在新版本
 */
async function tryLoadOtaVersion(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false

  const savedVersion = localStorage.getItem(CURRENT_VERSION_KEY)
  if (!savedVersion || savedVersion === 'builtin') return false

  try {
    // 1. 读取当前正在加载的 version.json
    let currentBuildSha = ''
    try {
      const r = await fetch('/version.json', { cache: 'no-store' })
      if (r.ok) {
        const v = await r.json()
        currentBuildSha = v.buildSha || ''
      }
    } catch {}

    // 如果当前 WebView 已经在加载新版本的资源，就不用切换
    if (currentBuildSha && currentBuildSha === savedVersion) {
      console.log('[OTA] WebView 已在新版本', savedVersion, '，无需切换')
      return false
    }

    console.log(`[OTA] 需要切换: 当前 buildSha=${currentBuildSha}, 目标=${savedVersion}`)

    // 2. 防止死循环: 检查本次会话是否已经尝试过
    const attemptKey = 'OTA_LOAD_ATTEMPT_' + savedVersion
    if (sessionStorage.getItem(attemptKey)) {
      console.warn('[OTA] 本次会话已尝试过加载', savedVersion, '避免死循环，跳过')
      return false
    }
    sessionStorage.setItem(attemptKey, Date.now().toString())

    // 3. 确认目录存在
    const versionDir = `${WEBROOT_DIR}/${savedVersion}`
    await Filesystem.stat({ path: versionDir, directory: Directory.Data })

    // 4. 获取绝对路径
    const uri = await Filesystem.getUri({ path: versionDir, directory: Directory.Data })
    const absPath = uri.uri.replace(/^file:\/\//, '')
    console.log('[OTA] 目录存在，路径:', absPath)

    // 5. 通过 WebView plugin 切换 basePath
    const webviewPlugin = (window as any).Capacitor?.Plugins?.WebView
    if (!webviewPlugin || typeof webviewPlugin.setServerBasePath !== 'function') {
      console.warn('[OTA] WebView plugin 不可用')
      return false
    }

    console.log('[OTA] 调用 setServerBasePath ->', absPath)
    // setServerBasePath 内部会触发 WebView reload
    // Promise 可能永不 resolve（因为 WebView 已被替换），用超时保护
    await Promise.race([
      webviewPlugin.setServerBasePath({ path: absPath }),
      new Promise(resolve => setTimeout(resolve, 2000))
    ])
    console.log('[OTA] setServerBasePath 已调用，2s 后触发 reload')

    // 6. 兜底 reload（如果 setServerBasePath 没自动触发的话）
    setTimeout(() => {
      console.log('[OTA] 触发 window.location.reload() 加载新版本')
      window.location.reload()
    }, 500)

    // 返回 true 表示正在切换，跳过本次 render
    return true
  } catch (e: any) {
    console.error('[OTA] 加载新版本失败:', e.message)
    // 目录不存在或加载失败，清除版本号回退到 builtin
    localStorage.removeItem(CURRENT_VERSION_KEY)
    return false
  }
}

async function bootstrap() {
  // 优先尝试加载 OTA 新版本
  const switching = await tryLoadOtaVersion()
  if (switching) {
    // 正在切换，不渲染 App，等待 reload
    console.log('[OTA] 正在切换版本，暂停渲染')
    return
  }

  // 启动时预加载 version.json (fetch 失败会自动兜底,不阻塞)
  loadBuiltinVersion()

  // 启动时应用已保存的主题
  applyTheme(useTheme.getState().mode)

  // 订阅主题变化
  useTheme.subscribe(state => applyTheme(state.mode))

  // auto 模式下监听系统主题变化
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useTheme.getState().mode === 'auto') applyTheme('auto')
  })

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

bootstrap()
