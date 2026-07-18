import React, { useState, useEffect } from 'react'
import { Card, List, Button, Badge, Tag, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { otaDebugLogger, OTALogEntry, checkForUpdate, downloadAndApply } from '../../utils/otaUpdater'
import { Capacitor } from '@capacitor/core'
import './OTADebug.css'

const OTADebug: React.FC = () => {
  const nav = useNavigate()
  const [logs, setLogs] = useState<OTALogEntry[]>([])
  const [currentVersion, setCurrentVersion] = useState('')
  const [latestVersion, setLatestVersion] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [updateStatus, setUpdateStatus] = useState('')
  const [updateProgress, setUpdateProgress] = useState(0)

  const loadLogs = () => {
    setLogs(otaDebugLogger.getLogs())
    setCurrentVersion(localStorage.getItem('mobile_ops_dist_version') || 'builtin')
  }

  useEffect(() => {
    loadLogs()
    // 每秒刷新日志（如果正在更新）
    const interval = setInterval(() => {
      if (isDownloading) {
        loadLogs()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isDownloading])

  const handleRefresh = () => {
    loadLogs()
  }

  const handleClearLogs = () => {
    if (confirm('确定清除所有 OTA 调试日志？')) {
      otaDebugLogger.clearLogs()
      loadLogs()
    }
  }

  const handleCheckUpdate = async () => {
    setIsChecking(true)
    try {
      const result = await checkForUpdate()
      setLatestVersion(result.info?.version || '')
      loadLogs()
      if (result.hasUpdate) {
        Toast.show({ content: `发现新版本: ${result.info?.version}`, icon: 'success' })
      } else {
        Toast.show({ content: '已是最新版本', icon: 'success' })
      }
    } catch (e: any) {
      console.error('检查更新失败:', e)
      Toast.show({ content: `检查失败: ${e.message}`, icon: 'fail' })
    } finally {
      setIsChecking(false)
    }
  }

  const handleDownloadAndApply = async () => {
    if (!latestVersion) {
      Toast.show({ content: '请先检查更新', icon: 'fail' })
      return
    }

    setIsDownloading(true)
    setUpdateStatus('开始下载...')
    setUpdateProgress(0)

    try {
      await downloadAndApply(
        {
          version: latestVersion,
          sha256: '',
          size: 0,
          released_at: new Date().toISOString(),
          download: ''
        },
        (loaded, total) => {
          const percent = Math.round((loaded / total) * 100)
          setUpdateProgress(percent)
        },
        (status) => {
          setUpdateStatus(status)
          loadLogs()
        }
      )
    } catch (e: any) {
      Toast.show({ content: `更新失败: ${e.message}`, icon: 'fail' })
      loadLogs()
    } finally {
      setIsDownloading(false)
    }
  }

  const handleExportLogs = async () => {
    const logsText = JSON.stringify(logs, null, 2)
    try {
      await navigator.clipboard.writeText(logsText)
      Toast.show({ content: '日志已复制到剪贴板', icon: 'success' })
    } catch (e) {
      Toast.show({ content: '复制失败', icon: 'fail' })
    }
  }

  const handleForceReload = () => {
    if (confirm('强制重载会立即刷新页面，确定继续？')) {
      window.location.reload()
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success': return 'success'
      case 'warn': return 'warning'
      case 'error': return 'danger'
      default: return 'default'
    }
  }

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    const ms = String(d.getMilliseconds()).padStart(3, '0')
    return `${hh}:${mm}:${ss}.${ms}`
  }

  return (
    <div className="page">
      <div className="page-header" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button className="back-btn" onClick={() => nav('/settings')}>← 设置</button>
        <span className="title">OTA 更新调试</span>
        <button className="back-btn" onClick={handleRefresh} style={{ visibility: 'visible' }}>刷新</button>
      </div>

      <div className="page-content">
        {/* 环境信息 */}
        <Card title="环境信息">
          <List mode="card">
            <List.Item extra={<Badge content={currentVersion} color="primary" />}>
              当前版本
            </List.Item>
            {latestVersion && (
              <List.Item extra={<Badge content={latestVersion} color="success" />}>
                最新版本
              </List.Item>
            )}
            <List.Item extra={Capacitor.getPlatform()}>
              平台
            </List.Item>
            <List.Item extra={Capacitor.isNativePlatform() ? '是' : '否'}>
              Native
            </List.Item>
            <List.Item extra={<span style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>{import.meta.env.VITE_API_BASE || '/api/v1'}</span>}>
              API Base
            </List.Item>
          </List>
        </Card>

        {/* 手动操作 */}
        <Card title="手动操作" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
            <Button block onClick={handleCheckUpdate} loading={isChecking} disabled={isDownloading}>
              {isChecking ? '检查中...' : '检查更新'}
            </Button>
            {latestVersion && latestVersion !== currentVersion && (
              <Button block color="success" onClick={handleDownloadAndApply} loading={isDownloading}>
                {isDownloading ? `下载并应用 (${updateProgress}%)` : '下载并应用'}
              </Button>
            )}
            {isDownloading && (
              <div style={{ textAlign: 'center', fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                {updateStatus}
              </div>
            )}
            <Button block fill="outline" onClick={handleForceReload}>
              强制重载页面
            </Button>
            <Button block fill="outline" onClick={handleExportLogs}>
              导出日志到剪贴板
            </Button>
            <Button block fill="outline" color="danger" onClick={handleClearLogs}>
              清除所有日志
            </Button>
          </div>
        </Card>

        {/* 日志列表 */}
        <Card title={`调试日志 (${logs.length})`} style={{ marginTop: 12 }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)' }}>
              暂无日志
            </div>
          ) : (
            <div className="ota-log-list">
              {[...logs].reverse().map((log, idx) => (
                <div key={idx} className={`ota-log-entry ota-log-${log.level}`}>
                  <div className="ota-log-header">
                    <Tag color={getLevelColor(log.level)} style={{ margin: 0 }}>
                      {log.step}
                    </Tag>
                    <span className="ota-log-time">{formatTimestamp(log.timestamp)}</span>
                  </div>
                  <div className="ota-log-message">{log.message}</div>
                  {log.details && (
                    <details className="ota-log-details">
                      <summary>详细信息</summary>
                      <pre>{JSON.stringify(log.details, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default OTADebug
