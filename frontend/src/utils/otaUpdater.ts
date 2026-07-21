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
const OTA_DEBUG_LOG_KEY = 'mobile_ops_ota_debug_log'
const MAX_LOG_ENTRIES = 200

export interface OTALogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'success'
  step: string
  message: string
  details?: any
}

class OTADebugLogger {
  private logs: OTALogEntry[] = []

  constructor() {
    this.loadLogs()
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(OTA_DEBUG_LOG_KEY)
      if (stored) {
        this.logs = JSON.parse(stored)
      }
    } catch (e) {
      console.warn('[OTADebugLogger] Failed to load logs:', e)
    }
  }

  private saveLogs() {
    try {
      // 只保留最近 MAX_LOG_ENTRIES 条
      if (this.logs.length > MAX_LOG_ENTRIES) {
        this.logs = this.logs.slice(-MAX_LOG_ENTRIES)
      }
      localStorage.setItem(OTA_DEBUG_LOG_KEY, JSON.stringify(this.logs))
    } catch (e) {
      console.warn('[OTADebugLogger] Failed to save logs:', e)
    }
  }

  log(level: 'info' | 'warn' | 'error' | 'success', step: string, message: string, details?: any) {
    const entry: OTALogEntry = {
      timestamp: Date.now(),
      level,
      step,
      message,
      details
    }
    this.logs.push(entry)
    this.saveLogs()

    // 同时输出到 console
    const prefix = `[OTA ${step}]`
    if (level === 'error') {
      console.error(prefix, message, details || '')
    } else if (level === 'warn') {
      console.warn(prefix, message, details || '')
    } else {
      console.log(prefix, message, details || '')
    }
  }

  getLogs(): OTALogEntry[] {
    return [...this.logs]
  }

  clearLogs() {
    this.logs = []
    localStorage.removeItem(OTA_DEBUG_LOG_KEY)
  }
}

export const otaDebugLogger = new OTADebugLogger()

export interface UpdateInfo {
  version: string
  sha256: string
  size: number
  released_at: string
  download: string
}

// 本地保存的版本信息（用于更精确的更新检测）
const SAVED_SHA256_KEY = 'mobile_ops_dist_sha256'

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
  const currentSha256 = localStorage.getItem(SAVED_SHA256_KEY) || ''
  otaDebugLogger.log('info', 'checkForUpdate', `开始检查更新，当前版本: ${currentVersion}, SHA256: ${currentSha256.slice(0, 8)}...`)

  try {
    const r = await axios.get(`${API_BASE}/updates/latest`, {
      timeout: 12000, // 12s (慢网络容错)
      headers: {
        Authorization: `Bearer ${localStorage.getItem('mobile_ops_token') || ''}`
      }
    })
    const info = r.data as UpdateInfo

    // 优先使用 sha256 判断是否有更新（更准确），降级到 version 比对
    const hasUpdate = currentSha256 ? (info.sha256 !== currentSha256) : (info.version !== currentVersion)

    otaDebugLogger.log(
      hasUpdate ? 'success' : 'info',
      'checkForUpdate',
      hasUpdate ? `发现新版本: ${info.version} (SHA256 不同)` : `已是最新版本: ${info.version}`,
      { info, currentSha256: currentSha256.slice(0, 8) + '...', serverSha256: info.sha256.slice(0, 8) + '...' }
    )

    return {
      info,
      currentVersion,
      hasUpdate
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

    otaDebugLogger.log('error', 'checkForUpdate', error, {
      code: e.code,
      status: e.response?.status,
      message: e.message,
      stack: e.stack
    })

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
  otaDebugLogger.log('info', 'downloadAndApply', `开始下载并应用版本: ${info.version}`, { info })

  if (!Capacitor.isNativePlatform()) {
    const error = 'OTA 更新仅在原生 App 内可用; 浏览器请刷新页面'
    otaDebugLogger.log('error', 'downloadAndApply', error)
    throw new Error(error)
  }
  const token = localStorage.getItem('mobile_ops_token') || ''

  // 1. 下载 zip 二进制
  onStatus?.('正在下载更新包...')
  otaDebugLogger.log('info', 'download', '开始下载 dist.zip')
  try {
    const zipResp = await axios.get(`${API_BASE}/updates/dist.zip`, {
      responseType: 'arraybuffer',
      timeout: 120000,
      headers: { Authorization: `Bearer ${token}` },
      onDownloadProgress: (e) => {
        if (onProgress) onProgress(e.loaded, e.total || info.size)
      }
    })
    const zipData = new Uint8Array(zipResp.data)
    otaDebugLogger.log('success', 'download', `下载完成，大小: ${zipData.length} 字节`)

    // 2. 解压
    onStatus?.('正在解压文件...')
    otaDebugLogger.log('info', 'unzip', '开始解压文件')
    const files = unzipSync(zipData)
    const fileCount = Object.keys(files).length
    otaDebugLogger.log('success', 'unzip', `解压完成，共 ${fileCount} 个文件`)

    // 从解压结果里读 version.json,更新活跃版本号
    const versionEntry = files['version.json'] || files['dist/version.json']
    if (versionEntry) {
      try {
        const v = JSON.parse(strFromU8(versionEntry)) as AppVersion
        setActiveVersion(v)
        otaDebugLogger.log('info', 'version', `读取到 version.json: ${v.appVersion}`, v)
      } catch (e) {
        otaDebugLogger.log('warn', 'version', 'version.json 解析失败', e)
      }
    }

    // 3. 写入 Directory.Data/webroot/<version>/
    const versionDir = `${WEBROOT_DIR}/${info.version}`

    // 清理老的临时目录 (同名的 version 目录)
    onStatus?.('正在准备存储目录...')
    otaDebugLogger.log('info', 'cleanup', `清理旧目录: ${versionDir}`)
    try {
      await Filesystem.rmdir({
        path: versionDir,
        directory: Directory.Data,
        recursive: true
      })
      otaDebugLogger.log('info', 'cleanup', '旧目录清理完成')
    } catch (e) {
      otaDebugLogger.log('info', 'cleanup', '旧目录不存在，跳过清理')
    }

    otaDebugLogger.log('info', 'mkdir', `创建新目录: ${versionDir}`)
    await Filesystem.mkdir({
      path: versionDir,
      directory: Directory.Data,
      recursive: true
    })
    otaDebugLogger.log('success', 'mkdir', '目录创建完成')

    // 逐个写文件. fflate 的 files 键可能带 dist/ 前缀,统一去掉
    onStatus?.('正在写入文件...')
    otaDebugLogger.log('info', 'writeFiles', `开始写入 ${fileCount} 个文件`)
    const entries = Object.entries(files)
    let writtenCount = 0
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
      writtenCount++
    }
    otaDebugLogger.log('success', 'writeFiles', `文件写入完成，共 ${writtenCount} 个文件`)

    // 4. 拿绝对路径（加超时保护）
    onStatus?.('正在应用更新...')
    otaDebugLogger.log('info', 'getUri', `获取目录绝对路径: ${versionDir}`)
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
      otaDebugLogger.log('success', 'getUri', `获取到绝对路径: ${absPath}`)
    } catch (e: any) {
      otaDebugLogger.log('error', 'getUri', 'getUri 失败或超时，保存版本号后提示手动重启', {
        message: e.message,
        stack: e.stack
      })
      // 如果 getUri 失败，保存版本号和 SHA256 后让用户手动重启
      localStorage.setItem(CURRENT_VERSION_KEY, info.version)
      localStorage.setItem(SAVED_SHA256_KEY, info.sha256)
      localStorage.setItem('OTA_RESTART_PENDING', Date.now().toString())
      otaDebugLogger.log('info', 'exitApp', '保存版本号和 SHA256 成功，准备提示用户手动重启')
      onStatus?.('更新完成！请手动重启 App 生效')
      return
    }

    // 5. 跳过 setServerBasePath（可能导致 WebView 死锁，App 启动时会自动检测新路径）
    otaDebugLogger.log('info', 'setServerBasePath', '跳过 setServerBasePath，依赖 App 启动时自动检测')

    // 6. 保存版本号和 SHA256（用同步的标记确保写入）
    otaDebugLogger.log('info', 'saveVersion', `保存版本号: ${info.version}, SHA256: ${info.sha256.slice(0, 8)}...`)
    localStorage.setItem(CURRENT_VERSION_KEY, info.version)
    localStorage.setItem(SAVED_SHA256_KEY, info.sha256)
    // 设置一个重启标记，App 启动时检测到这个标记说明是更新后重启
    localStorage.setItem('OTA_RESTART_PENDING', Date.now().toString())
    otaDebugLogger.log('success', 'saveVersion', '版本号和 SHA256 保存成功，已设置重启标记')

    // 7. 温和退出 App 让用户手动重启（比强制 reload 更安全）
    otaDebugLogger.log('info', 'exitApp', '准备温和退出 App')
    onStatus?.('更新完成！请手动重启 App 生效')

    // 延迟 2 秒让用户看到提示，然后尝试退出
    setTimeout(async () => {
      otaDebugLogger.log('info', 'exitApp', '尝试调用 App.exitApp()')
      try {
        const { App } = await import('@capacitor/app')
        await App.exitApp()
        otaDebugLogger.log('success', 'exitApp', 'App.exitApp() 调用成功')
      } catch (e: any) {
        otaDebugLogger.log('warn', 'exitApp', 'App.exitApp() 失败，提示用户手动重启', {
          message: e.message
        })
        // exitApp 失败时不做任何操作，让用户看到"请手动重启"的提示
        // 不执行任何 reload，避免死机
      }
    }, 2000)
  } catch (e: any) {
    const errorMsg = e.message || '未知错误'
    otaDebugLogger.log('error', 'downloadAndApply', `更新失败: ${errorMsg}`, {
      message: e.message,
      code: e.code,
      stack: e.stack
    })
    throw e
  }
}

export function getCurrentVersion(): string {
  return localStorage.getItem(CURRENT_VERSION_KEY) || 'builtin'
}
