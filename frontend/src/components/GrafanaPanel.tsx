import { useMemo, useState } from 'react'
import { Button } from 'antd-mobile'
import { useTheme, resolveTheme } from '@/store'

interface Props {
  originalUrl: string   // 用户粘的原始 URL
  title?: string
  from?: string
  to?: string
  height?: number
  onDelete?: () => void
}

// GrafanaPanel 用 iframe 嵌入反代后的 Grafana
// 反代域名: grafana.101-43-172-231.nip.io:18443（自动带 Token）
const GRAFANA_PROXY_HOST = window.location.hostname.startsWith('grafana.')
  ? window.location.host
  : `grafana.${window.location.host}`

export default function GrafanaPanel({
  originalUrl, title, from = 'now-1h', to = 'now', height = 400, onDelete
}: Props) {
  const themeMode = useTheme(s => s.mode)
  const themeName = resolveTheme(themeMode)
  const [tick, setTick] = useState(0)

  // 把原始 URL host 换成反代 host，加上 kiosk 模式 + 主题 + 时间范围
  const iframeUrl = useMemo(() => {
    try {
      const u = new URL(originalUrl)
      u.protocol = 'https:'
      u.host = GRAFANA_PROXY_HOST
      // 参数覆盖 / 补充
      u.searchParams.set('kiosk', 'tv')  // tv 模式：只隐藏侧边栏和顶栏，保留时间选择
      u.searchParams.set('theme', themeName)
      u.searchParams.set('from', from)
      u.searchParams.set('to', to)
      // 缓存打破，让每次刷新都重新加载
      u.searchParams.set('_t', String(tick))
      return u.toString()
    } catch {
      return ''
    }
  }, [originalUrl, themeName, from, to, tick])

  if (!iframeUrl) {
    return (
      <div className="card">
        <div style={{ color: 'var(--danger)', fontSize: 12 }}>URL 解析失败: {originalUrl}</div>
      </div>
    )
  }

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8
      }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title || '📊 Dashboard'}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="mini" fill="none" onClick={() => { window.open(iframeUrl, '_blank') }}>新窗口</Button>
          <Button size="mini" fill="none" onClick={() => setTick(t => t + 1)}>刷新</Button>
          {onDelete && <Button size="mini" fill="none" color="danger" onClick={onDelete}>删除</Button>}
        </div>
      </div>
      <iframe
        key={tick}
        src={iframeUrl}
        title={title}
        style={{
          width: '100%',
          height: `${height}px`,
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          background: 'var(--bg-elevated)'
        }}
        loading="lazy"
        allow="fullscreen"
      />
      <div style={{
        fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6,
        wordBreak: 'break-all'
      }}>
        iframe 加载失败？点"新窗口"在浏览器打开 · 代理: {GRAFANA_PROXY_HOST}
      </div>
    </div>
  )
}
