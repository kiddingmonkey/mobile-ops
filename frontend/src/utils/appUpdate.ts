/**
 * APK自动更新管理
 */

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Toast } from 'antd-mobile'

export interface VersionInfo {
  version: string
  build: string
  download_url: string
  changelog: string
  required: boolean
  file_size: number
  published_at: string
}

// 检查是否有新版本
export async function checkForUpdates(): Promise<{ hasUpdate: boolean; versionInfo?: VersionInfo }> {
  // 只在原生应用中检查更新
  if (!Capacitor.isNativePlatform()) {
    return { hasUpdate: false }
  }

  try {
    const response = await fetch('/api/v1/version/latest', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      console.error('[Update] Failed to check version:', response.status)
      return { hasUpdate: false }
    }

    const versionInfo: VersionInfo = await response.json()

    // 获取当前版本号（从package.json或环境变量）
    const currentVersion = getCurrentVersion()

    // 比较版本号
    if (compareVersions(versionInfo.version, currentVersion) > 0) {
      return { hasUpdate: true, versionInfo }
    }

    return { hasUpdate: false }
  } catch (error) {
    console.error('[Update] Check failed:', error)
    return { hasUpdate: false }
  }
}

// 获取当前版本号
function getCurrentVersion(): string {
  // 从打包时注入的版本号获取
  return import.meta.env.VITE_APP_VERSION || '1.1.0'
}

// 比较版本号 (简单实现)
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}

// 下载APK文件
export async function downloadAPK(
  url: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    // 使用fetch下载
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`)
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const chunks: Uint8Array[] = []
    let receivedLength = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      receivedLength += value.length

      // 更新进度
      if (onProgress && contentLength > 0) {
        const progress = (receivedLength / contentLength) * 100
        onProgress(progress)
      }
    }

    // 合并所有块
    const blob = new Blob(chunks as BlobPart[])
    const base64 = await blobToBase64(blob)

    // 保存到文件系统
    const fileName = `cloudpilot-${Date.now()}.apk`
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache
    })

    return result.uri
  } catch (error) {
    console.error('[Update] Download failed:', error)
    throw error
  }
}

// Blob转Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 安装APK
export async function installAPK(fileUri: string): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('仅支持Android平台')
  }

  try {
    // 使用Capacitor的App插件打开文件
    // 注意：需要在AndroidManifest.xml中配置FileProvider
    const { App } = await import('@capacitor/app')

    // 触发系统安装界面
    // Android会自动处理APK安装
    window.open(fileUri, '_system')

    Toast.show({
      content: '请在弹出的安装界面中完成安装',
      duration: 3000
    })
  } catch (error) {
    console.error('[Update] Install failed:', error)
    throw error
  }
}
