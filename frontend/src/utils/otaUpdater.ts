import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { unzipSync, strFromU8 } from 'fflate'
import axios from 'axios'
import { setActiveVersion, AppVersion } from './version'

/**
 * 前端 OTA 更新逻辑
 *
 * 流程:
 * 1. GET /api/v1/updates/latest -> {version, size, sha256, download}
 * 2. 与本地 version.txt 对比,新则下载 dist.zip
 * 3. 解压到 Directory.Data/webroot/<version>/
 * 4. 更新 last_version 指向新目录
 * 5. Capacitor 8: 用 WebView.setServerBasePath 切目录 + reload
 *    非 native (纯浏览器): 只清 SW 缓存并 reload
 */

const CURRENT_VERSION_KEY = 'mobile_ops_dist_version'
const WEBROOT_DIR = 'webroot'
const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

export interface UpdateInfo {
  version: string
  sha256: string
  size: number
  released_at: string
  download: string
}

// Capacitor 8 WebView plugin (setServerBasePath)
async function tryGetWebViewPlugin(): Promise<any | null> {
  try {
    // Capacitor 8 内置 WebView plugin
    const p = (window as any).Capacitor?.Plugins?.WebView
    if (p && typeof p.setServerBasePath === 'function') return p
  } catch {}
  return null
}

// 拉最新版本信息
export async function checkForUpdate(): Promise<{
  info: UpdateInfo | null
  currentVersion: string
  hasUpdate: boolean
  error?: string
}> {
  const currentVersion = localStorage.getItem(CURRENT_VERSION_KEY) || 'builtin'
  try {
    const r = await axios.get(`${API_BASE}/updates/latest`, {
      timeout: 12000, // 12s (慢网络容错)
      headers: {
        Authorization: `Bearer ${localStorage.getItem('mobile_ops_token') || ''}`
      }
    })
    const info = r.data as UpdateInfo
    return {
      info,
      currentVersion,
      hasUpdate: info.version !== currentVersion
    }
  } catch (e: any) {
    let error = '检查失败'
    if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
      error = '连接超时 — 请检查网络或稍后重试'
    } else if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
      error = '网络不通 — 请检查后端地址或安全组白名单'
    } else if (e.response?.status === 404) {
      error = '服务器上无更新包 (dist.zip 未部署)'
    } else if (e.response?.status === 401) {
      error = '登录过期 — 请重新登录后再试'
    } else if (e.response?.data?.error) {
      error = e.response.data.error
    } else if (e.message) {
      error = e.message
    }
    return {
      info: null,
      currentVersion,
      hasUpdate: false,
      error
    }
  }
}

// 下载 dist.zip 并解压到本地目录
export async function downloadAndApply(
  info: UpdateInfo,
  onProgress?: (loaded: number, total: number) => void,
  onStatus?: (status: string) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('OTA 更新仅在 APK 内可用; 浏览器请刷新页面')
  }
  const token = localStorage.getItem('mobile_ops_token') || ''

  // 1. 下载 zip 二进制
  onStatus?.('正在下载更新包...')
  const zipResp = await axios.get(`${API_BASE}/updates/dist.zip`, {
    responseType: 'arraybuffer',
    timeout: 120000,
    headers: { Authorization: `Bearer ${token}` },
    onDownloadProgress: (e) => {
      if (onProgress) onProgress(e.loaded, e.total || info.size)
    }
  })
  const zipData = new Uint8Array(zipResp.data)

  // 2. 解压
  onStatus?.('正在解压文件...')
  const files = unzipSync(zipData)

  // 从解压结果里读 version.json,更新活跃版本号
  const versionEntry = files['version.json'] || files['dist/version.json']
  if (versionEntry) {
    try {
      const v = JSON.parse(strFromU8(versionEntry)) as AppVersion
      setActiveVersion(v)
    } catch {}
  }

  // 3. 写入 Directory.Data/webroot/<version>/
  const versionDir = `${WEBROOT_DIR}/${info.version}`

  // 清理老的临时目录 (同名的 version 目录)
  onStatus?.('正在准备存储目录...')
  try {
    await Filesystem.rmdir({
      path: versionDir,
      directory: Directory.Data,
      recursive: true
    })
  } catch {
    // 不存在忽略
  }

  await Filesystem.mkdir({
    path: versionDir,
    directory: Directory.Data,
    recursive: true
  })

  // 逐个写文件. fflate 的 files 键可能带 dist/ 前缀,统一去掉
  onStatus?.('正在写入文件...')
  const entries = Object.entries(files)
  for (let i = 0; i < entries.length; i++) {
    const [rawName, content] = entries[i]
    if (rawName.endsWith('/')) continue // 目录
    // 去掉 zip 里的顶层 dist/ 前缀,如果存在
    let name = rawName.replace(/^dist\//, '')
    if (!name) continue

    // 显示写入进度
    if (i % 5 === 0) {
      onStatus?.(`正在写入文件 ${i + 1}/${entries.length}`)
    }

    // 创建中间目录
    const dir = name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : ''
    if (dir) {
      try {
        await Filesystem.mkdir({
          path: `${versionDir}/${dir}`,
          directory: Directory.Data,
          recursive: true
        })
      } catch {}
    }

    // 二进制文件 base64 写入; 文本(*.html/js/css/json/svg)用 utf8 写入
    const isText = /\.(html|js|css|json|svg|webmanifest|txt|map)$/i.test(name)
    if (isText) {
      await Filesystem.writeFile({
        path: `${versionDir}/${name}`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        data: strFromU8(content)
      })
    } else {
      // base64
      let bin = ''
      for (let j = 0; j < content.length; j++) bin += String.fromCharCode(content[j])
      const b64 = btoa(bin)
      await Filesystem.writeFile({
        path: `${versionDir}/${name}`,
        directory: Directory.Data,
        data: b64
      })
    }
  }

  // 4. 拿绝对路径（加超时保护）
  onStatus?.('正在应用更新...')
  console.log('[OTA] Step 4: Getting URI for', versionDir)
  let absPath = ''
  try {
    const uri = await Promise.race([
      Filesystem.getUri({
        path: versionDir,
        directory: Directory.Data
      }),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('getUri timeout after 8s')), 8000))
    ])
    absPath = uri.uri.replace(/^file:\/\//, '')
    console.log('[OTA] URI obtained:', absPath)
  } catch (e) {
    console.warn('[OTA] getUri failed or timeout, fallback to direct reload', e)
    // 如果getUri失败，直接reload让App重新检测
    localStorage.setItem(CURRENT_VERSION_KEY, info.version)
    console.log('[OTA] Saved version and reloading in 500ms...')
    onStatus?.('准备重启...')
    setTimeout(() => {
      console.log('[OTA] Executing reload now')
      window.location.reload()
    }, 500)
    return
  }

  // 5. 切 WebView 到新目录（带超时保护）
  console.log('[OTA] Step 5: Switching WebView basePath')
  const webview = await tryGetWebViewPlugin()
  if (webview) {
    try {
      await Promise.race([
        webview.setServerBasePath({ path: absPath }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('setServerBasePath timeout')), 5000))
      ])
      console.log('[OTA] setServerBasePath done')
    } catch (e) {
      console.warn('[OTA] setServerBasePath failed/timeout, will reload anyway', e)
    }
  }

  // 6. 保存版本号
  console.log('[OTA] Step 6: Saving version', info.version)
  localStorage.setItem(CURRENT_VERSION_KEY, info.version)

  // 7. reload 生效（延迟 300ms 确保 localStorage 写入完成）
  console.log('[OTA] Step 7: Scheduling reload in 300ms')
  onStatus?.('更新完成，即将重启...')
  setTimeout(() => {
    console.log('[OTA] Executing reload now')
    window.location.reload()
  }, 300)
}

export function getCurrentVersion(): string {
  return localStorage.getItem(CURRENT_VERSION_KEY) || 'builtin'
}
