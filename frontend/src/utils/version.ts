/**
 * 版本号管理
 *
 * 优先级:
 * 1. localStorage 中 OTA 更新后写入的版本 (最新)
 * 2. dist 里 build 时生成的 version.json (启动时 fetch)
 * 3. 兜底: "1.1.0+builtin"
 */

const KEY = 'mobile_ops_active_version'

export interface AppVersion {
  appVersion: string   // 1.1.0
  buildSha: string     // 07879d88
  buildTime: string    // ISO
  runNumber: string    // github actions run
}

let cache: AppVersion | null = null

// 启动时调用: 读取 dist/version.json 缓存到内存
export async function loadBuiltinVersion(): Promise<AppVersion> {
  try {
    const r = await fetch('/version.json', { cache: 'no-store' })
    if (r.ok) {
      cache = await r.json()
      return cache!
    }
  } catch {}
  cache = {
    appVersion: '1.1.0',
    buildSha: 'builtin',
    buildTime: new Date().toISOString(),
    runNumber: 'dev'
  }
  return cache
}

export function getActiveVersion(): AppVersion {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try { return JSON.parse(raw) as AppVersion } catch {}
  }
  return cache || { appVersion: '1.1.0', buildSha: 'builtin', buildTime: '', runNumber: 'dev' }
}

export function setActiveVersion(v: AppVersion) {
  localStorage.setItem(KEY, JSON.stringify(v))
}

export function clearActiveVersion() {
  localStorage.removeItem(KEY)
}

// 短格式: 1.1.0 (07879d88)
export function versionShort(v: AppVersion): string {
  return `${v.appVersion} (${v.buildSha})`
}

// 相对时间: 2h ago
export function relTime(iso: string): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const d = Date.now() - t
  if (d < 60_000) return '刚刚'
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m 前`
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h 前`
  return `${Math.floor(d / 86400_000)}d 前`
}
