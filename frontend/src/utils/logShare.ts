/**
 * 日志下载 + 分享工具
 * 支持：下载到本地、调用系统分享（微信/飞书/邮件等）
 */

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

interface ShareOptions {
  content: string
  filename: string
  title?: string
}

/**
 * 下载日志到本地（Web端触发浏览器下载 / App端保存到文件系统）
 */
export async function downloadLog(content: string, filename: string): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    // App端：保存到Cache目录
    try {
      const result = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      })
      return result.uri
    } catch (e) {
      console.error('[downloadLog] Failed:', e)
      return null
    }
  } else {
    // Web端：触发浏览器下载
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      return filename
    } catch (e) {
      console.error('[downloadLog] Web download failed:', e)
      return null
    }
  }
}

/**
 * 分享日志（弹出系统分享面板，让用户选择微信/飞书/邮件等）
 */
export async function shareLog({ content, filename, title = '日志文件' }: ShareOptions): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // Web端：使用Web Share API（如支持）
    if (navigator.share && navigator.canShare) {
      try {
        const blob = new Blob([content], { type: 'text/plain' })
        const file = new File([blob], filename, { type: 'text/plain' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            files: [file]
          })
          return true
        }
      } catch (e) {
        console.warn('[shareLog] Web Share API failed:', e)
      }
    }
    // 降级：直接下载
    await downloadLog(content, filename)
    return true
  }

  // App端：先写入文件，再调用系统分享
  try {
    const writeResult = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    })

    await Share.share({
      title,
      text: title,
      url: writeResult.uri,
      dialogTitle: '分享日志'
    })
    return true
  } catch (e: any) {
    // 用户取消分享不算错误
    if (e?.message?.includes('canceled') || e?.message?.includes('cancel')) {
      return false
    }
    console.error('[shareLog] Share failed:', e)
    throw e
  }
}

/**
 * 生成带时间戳的日志文件名
 */
export function makeLogFilename(prefix: string): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
  return `${safePrefix}_${y}${m}${d}_${h}${min}${s}.log`
}
