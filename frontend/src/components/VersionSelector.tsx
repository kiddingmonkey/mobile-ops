import React, { useState, useEffect } from 'react'
import { Popup, Button, Toast, Skeleton } from 'antd-mobile'
import axios from 'axios'
import { downloadAndApply } from '../utils/otaUpdater'

interface VersionRecord {
  version: string
  sha256: string
  size: number
  released_at: string
  changelog: string[]
  description: string
}

interface VersionHistory {
  versions: VersionRecord[]
}

interface Props {
  visible: boolean
  currentVersion: string
  onClose: () => void
}

const VersionSelector: React.FC<Props> = ({ visible, currentVersion, onClose }) => {
  const [history, setHistory] = useState<VersionHistory | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingVersion, setDownloadingVersion] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (visible) {
      loadHistory()
    }
  }, [visible])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('mobile_ops_token') || ''
      const resp = await axios.get<VersionHistory>(
        `${import.meta.env.VITE_API_BASE || '/api/v1'}/updates/history`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setHistory(resp.data)
    } catch (e: any) {
      Toast.show({ content: `加载版本历史失败: ${e.message}`, icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  const handleInstall = async (record: VersionRecord) => {
    if (downloading) return

    setDownloading(true)
    setDownloadingVersion(record.version)
    setProgress(0)

    try {
      await downloadAndApply(
        {
          version: record.version,
          sha256: record.sha256,
          size: record.size,
          released_at: record.released_at,
          download: '/api/v1/updates/dist.zip'
        },
        (loaded, total) => {
          setProgress(Math.round((loaded / total) * 100))
        },
        (status) => {
          console.log('OTA status:', status)
        }
      )
    } catch (e: any) {
      Toast.show({ content: `安装失败: ${e.message}`, icon: 'fail' })
    } finally {
      setDownloading(false)
      setDownloadingVersion('')
      setProgress(0)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        minHeight: '60vh',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ padding: '20px 16px 0', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>版本历史</div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          当前版本: <span style={{ fontWeight: 500, color: 'var(--primary-color)' }}>{currentVersion}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <>
            <Skeleton.Paragraph lineCount={3} animated />
            <Skeleton.Paragraph lineCount={3} animated style={{ marginTop: 16 }} />
          </>
        ) : history && history.versions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.versions.map((v) => {
              const isCurrent = v.version === currentVersion
              const isDownloading = downloading && downloadingVersion === v.version

              return (
                <div
                  key={v.version}
                  style={{
                    padding: 14,
                    background: isCurrent ? 'var(--primary-color-light)' : 'var(--bg-secondary)',
                    borderRadius: 10,
                    border: isCurrent ? '2px solid var(--primary-color)' : '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace' }}>
                          {v.version}
                        </span>
                        {isCurrent && (
                          <span
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              background: 'var(--primary-color)',
                              color: 'white',
                              borderRadius: 4,
                              fontWeight: 500
                            }}
                          >
                            当前版本
                          </span>
                        )}
                      </div>
                      {v.description && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          {v.description}
                        </div>
                      )}
                    </div>
                    {!isCurrent && (
                      <Button
                        size="small"
                        color="primary"
                        fill="solid"
                        loading={isDownloading}
                        disabled={downloading}
                        onClick={() => handleInstall(v)}
                        style={{ flexShrink: 0 }}
                      >
                        {isDownloading ? `${progress}%` : '安装'}
                      </Button>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    {formatDate(v.released_at)} · {formatSize(v.size)}
                  </div>

                  {v.changelog && v.changelog.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>
                        更新内容:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
                        {v.changelog.map((line, idx) => (
                          <li key={idx} style={{ marginBottom: 4 }}>
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 13 }}>暂无版本历史</div>
          </div>
        )}
      </div>
    </Popup>
  )
}

export default VersionSelector
