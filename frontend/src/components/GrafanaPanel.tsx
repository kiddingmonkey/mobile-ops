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
                style={{ color: 'var(--accent-blue)', cursor: 'pointer', fontSize: 18, userSelect: 'none' }}
                onClick={enterFullscreen}
              >⛶</span>
            )}
          </div>
        )}
        <iframe
          src={url}
          style={{ width: '100%', height, border: 0, display: 'block' }}
          allow="fullscreen"
        />
      </div>

      <Popup
        visible={fullscreen}
        onClose={exitFullscreen}
        destroyOnClose
        bodyStyle={{
          width: '100vw',
          height: '100vh',
          background: '#000',
          padding: 0,
          borderRadius: 0,
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* 关闭按钮 */}
          <div
            style={{
              position: 'fixed',
              top: 'max(8px, env(safe-area-inset-top))',
              right: 'max(8px, env(safe-area-inset-right))',
              zIndex: 9999,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
            onClick={exitFullscreen}
          >
            <CloseOutline fontSize={22} style={{ color: 'white' }} />
          </div>

          {/* 标题 */}
          {title && (
            <div
              style={{
                position: 'fixed',
                top: 'max(8px, env(safe-area-inset-top))',
                left: 'max(8px, env(safe-area-inset-left))',
                zIndex: 9999,
                background: 'rgba(0,0,0,0.7)',
                padding: '8px 14px',
                borderRadius: 8,
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                maxWidth: '60vw',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {title}
            </div>
          )}

          {/* iframe 铺满 */}
          <iframe
            src={url}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0
            }}
            allow="fullscreen"
          />
        </div>
      </Popup>
    </>
  )
}
