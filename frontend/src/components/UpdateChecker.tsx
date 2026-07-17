import { useEffect, useState } from 'react'
import { Dialog, ProgressBar, Toast } from 'antd-mobile'
import { Capacitor } from '@capacitor/core'
import { checkForUpdates, downloadAPK, installAPK, type VersionInfo } from '@/utils/appUpdate'

export default function UpdateChecker() {
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // 只在原生平台检查
    if (!Capacitor.isNativePlatform()) return

    // App启动5秒后检查更新（避免影响启动速度）
    const timer = setTimeout(() => {
      checkUpdate()
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const checkUpdate = async () => {
    if (checking || downloading) return

    setChecking(true)
    try {
      const { hasUpdate, versionInfo } = await checkForUpdates()

      if (hasUpdate && versionInfo) {
        showUpdateDialog(versionInfo)
      }
    } catch (error) {
      console.error('[UpdateChecker] Check failed:', error)
    } finally {
      setChecking(false)
    }
  }

  const showUpdateDialog = (versionInfo: VersionInfo) => {
    Dialog.confirm({
      title: '发现新版本',
      content: (
        <div style={{ textAlign: 'left', fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>版本号: </span>
            <span style={{ fontWeight: 600 }}>{versionInfo.version}</span>
          </div>
          {versionInfo.file_size > 0 && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>大小: </span>
              <span>{(versionInfo.file_size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          )}
          {versionInfo.changelog && (
            <div style={{ marginTop: 12, padding: 8, background: 'var(--bg-elevated)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>更新内容:</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {versionInfo.changelog}
              </div>
            </div>
          )}
        </div>
      ),
      confirmText: '立即更新',
      cancelText: versionInfo.required ? '稍后提醒' : '跳过',
      onConfirm: async () => {
        await handleUpdate(versionInfo)
      }
    })
  }

  const handleUpdate = async (versionInfo: VersionInfo) => {
    if (!versionInfo.download_url) {
      Toast.show({ content: '下载地址无效', icon: 'fail' })
      return
    }

    setDownloading(true)
    setProgress(0)

    const progressToast = Toast.show({
      icon: 'loading',
      content: (
        <div style={{ minWidth: 200 }}>
          <div style={{ marginBottom: 8 }}>正在下载更新...</div>
          <ProgressBar percent={progress} style={{ '--fill-color': 'var(--accent-blue)' }} />
          <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-tertiary)' }}>
            {progress.toFixed(0)}%
          </div>
        </div>
      ),
      duration: 0
    })

    try {
      // 下载APK
      const fileUri = await downloadAPK(versionInfo.download_url, (p) => {
        setProgress(p)
        Toast.clear()
        Toast.show({
          icon: 'loading',
          content: (
            <div style={{ minWidth: 200 }}>
              <div style={{ marginBottom: 8 }}>正在下载更新...</div>
              <ProgressBar percent={p} style={{ '--fill-color': 'var(--accent-blue)' }} />
              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-tertiary)' }}>
                {p.toFixed(0)}%
              </div>
            </div>
          ),
          duration: 0
        })
      })

      Toast.clear()
      Toast.show({ content: '下载完成，准备安装...', icon: 'success', duration: 1000 })

      // 安装APK
      await installAPK(fileUri)
    } catch (error: any) {
      Toast.clear()
      Toast.show({
        content: `更新失败: ${error.message || '未知错误'}`,
        icon: 'fail',
        duration: 3000
      })
    } finally {
      setDownloading(false)
      setProgress(0)
    }
  }

  // 这个组件不渲染任何UI
  return null
}
