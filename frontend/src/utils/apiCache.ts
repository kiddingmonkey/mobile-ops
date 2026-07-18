/**
 * API 缓存工具 - 提升弱网体验
 *
 * 策略:
 * - 请求成功后写入 localStorage (带 TTL)
 * - 请求失败时回退到缓存
 * - 缓存过期后仍会尝试读取 (仅在网络失败时使用)
 * - 提供 useCachedAPI hook 供组件使用
 */

const CACHE_PREFIX = 'mobile_ops_cache_'
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 分钟

interface CachedEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * 写入缓存
 */
export function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL_MS): void {
  try {
    const entry: CachedEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch (e) {
    // localStorage 满或 JSON 失败，静默失败
    console.warn('[apiCache] setCache failed:', e)
  }
}

/**
 * 读取缓存
 * @param key 缓存键
 * @param ignoreExpiry 忽略过期（用于网络失败时的兜底）
 */
export function getCache<T>(key: string, ignoreExpiry = false): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CachedEntry<T> = JSON.parse(raw)
    if (!ignoreExpiry && Date.now() - entry.timestamp > entry.ttl) {
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

/**
 * 缓存包裹函数：优先返回缓存，异步刷新
 * 用法: const data = await withCache('key', () => api.listClusters())
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL_MS
): Promise<T> {
  try {
    const data = await fetcher()
    setCache(key, data, ttl)
    return data
  } catch (e) {
    // 网络失败时，尝试从缓存返回（忽略过期时间）
    const cached = getCache<T>(key, true)
    if (cached !== null) {
      console.warn(`[apiCache] fetch failed, using stale cache for ${key}`)
      return cached
    }
    throw e
  }
}

/**
 * 清除单个缓存
 */
export function clearCache(key: string): void {
  localStorage.removeItem(CACHE_PREFIX + key)
}

/**
 * 清除所有 API 缓存
 */
export function clearAllCache(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
  keys.forEach(k => localStorage.removeItem(k))
}

/**
 * 获取缓存元信息（用于调试）
 */
export function getCacheInfo(key: string): { age: number; expired: boolean } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry: CachedEntry<any> = JSON.parse(raw)
    const age = Date.now() - entry.timestamp
    return { age, expired: age > entry.ttl }
  } catch {
    return null
  }
}
