import { useState, useEffect } from 'react'
import { Skeleton, ErrorBlock } from 'antd-mobile'

interface Props {
  clusterId: number
  dashboardUid: string
  panelId?: number
  timeRange?: string
  title?: string
  height?: number
}

/**
 * 通过后端代理获取 Grafana 面板图片
 * 解决 Mixed Content 和 X-Frame-Options 问题
 */
export default function GrafanaPanelImage({
  clusterId,
  dashboardUid,
  panelId = 1,
  timeRange = 'now-1h',
  title,
  height = 300
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    loadImage()
  }, [clusterId, dashboardUid, panelId, timeRange])

  const loadImage = async () => {
    setLoading(true)
    setError('')

    try {
      // 解析 timeRange
      const from = timeRange
      const to = 'now'

      // 构建后端代理 URL
      const params = new URLSearchParams({
        dash: dashboardUid,
        panel: panelId.toString(),
        from,
        to,
        theme: 'dark',
        w: '800',
        h: height.toString()
      })

      const url = `/api/v1/clusters/${clusterId}/grafana/panel?${params.toString()}`

      // 添加时间戳避免缓存
      setImageUrl(`${url}&_t=${Date.now()}`)
      setLoading(false)
    } catch (err: any) {
      setError(err?.message || '加载失败')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 12 }}>
        <Skeleton animated style={{ height }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 12 }}>
        <ErrorBlock
          status="default"
          title="加载失败"
          description={error}
        />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
      {title && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
          <span
            style={{ color: 'var(--accent-blue)', cursor: 'pointer', fontSize: 12 }}
            onClick={loadImage}
          >
            刷新
          </span>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <img
          src={imageUrl}
          alt={title || 'Grafana Panel'}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            background: '#000'
          }}
          onError={() => {
            setError('图片加载失败，请检查 Grafana 配置')
          }}
        />
      </div>
    </div>
  )
}
