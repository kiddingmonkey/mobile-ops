import { ReactNode } from 'react'

/**
 * 3D 舰桥面板通用外壳
 * 全息风格 hd-panel，右侧滑入，底色半透明
 */
export default function PanelShell({
  title,
  titleEn,
  color = '#4fc3f7',
  onClose,
  children,
}: {
  title: string
  titleEn: string
  color?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 5, 16, 0.55)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
        animation: 'hd-fade-in 0.25s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '65%',
          maxWidth: 720,
          background: 'linear-gradient(135deg, rgba(3,5,16,0.92) 0%, rgba(10,20,45,0.9) 100%)',
          borderLeft: `2px solid ${color}`,
          boxShadow: `-20px 0 60px ${color}40`,
          display: 'flex',
          flexDirection: 'column',
          animation: 'hd-slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 头部 */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${color}40`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: `linear-gradient(90deg, ${color}18 0%, transparent 100%)`,
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              letterSpacing: '0.3em',
              color,
              fontWeight: 700,
              textShadow: `0 0 8px ${color}`,
            }}>
              ◆ {titleEn}
            </div>
            <div style={{
              fontSize: 11,
              color: 'rgba(220,240,255,0.7)',
              marginTop: 2,
              letterSpacing: '0.1em',
            }}>
              {title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${color}60`,
              color,
              width: 28,
              height: 28,
              borderRadius: 2,
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes hd-slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
