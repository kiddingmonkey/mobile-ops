import { useState } from 'react'
import { Popup } from 'antd-mobile'
import { CloseOutline } from 'antd-mobile-icons'

interface Props {
  url: string
  title?: string
  height?: number
  enableFullscreen?: boolean
}

export default function GrafanaPanel({ url, title, height = 240, enableFullscreen = true }: Props) {
  const [fullscreen, setFullscreen] = useState(false)

  const enterFullscreen = async () => {
    setFullscreen(true)
    // 尝试横屏
    try {
      const so = screen.orientation as any
      if (so?.lock) await so.lock('landscape').catch(() => {})
    } catch {}
  }

  const exitFullscreen = async () => {
    setFullscreen(false)
    try {
      const so = screen.orientation as any
      if (so?.unlock) so.unlock()
    } catch {}
  }

  return (
    <>
      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
        {title && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
            {enableFullscreen && (
              <span
                style={{ color: 'var(--accent-blue)', cursor: 'pointer', fontSize: 18 }}
                onClick={enterFullscreen}
              >⛶</span>
            )}
          </div>
        )}
        <iframe
          src={url}
          style={{ width: '100%', height, border: 0, display: 'block' }}
          sandbox="allow-same-origin allow-scripts allow-forms"
        />
      </div>

      <Popup
        visible={fullscreen}
        onMaskClick={exitFullscreen}
        bodyStyle={{
          width: '100vw',
          height: '100vh',
          background: 'var(--bg-primary)',
          padding: 0,
          borderRadius: 0
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 100,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }} onClick={exitFullscreen}>
            <CloseOutline fontSize={20} style={{ color: 'white' }} />
          </div>
          {title && (
            <div style={{
              position: 'absolute', top: 8, left: 8, zIndex: 100,
              background: 'rgba(0,0,0,0.6)', padding: '6px 12px',
              borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600
            }}>{title}</div>
          )}
          <iframe
            src={url}
            style={{ width: '100%', height: '100%', border: 0 }}
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        </div>
      </Popup>
    </>
  )
}
