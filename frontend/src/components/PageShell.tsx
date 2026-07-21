import { ReactNode } from 'react'
import { LeftOutline } from 'antd-mobile-icons'
import { hapticLight } from '@/utils/haptics'
import { useTheme, resolveTheme } from '@/store'

interface Props {
  title: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
  children: ReactNode
  /** 是否使用弹窗式 flex 布局（内容区可自主控制滚动） */
  flex?: boolean
}

export default function PageShell({ title, subtitle, onBack, right, children, flex }: Props) {
  const themeMode = useTheme(s => s.mode)
  const isHolodeck = resolveTheme(themeMode) === 'holodeck'

  // Holodeck 模式：外层 HolodeckShell 已负责顶栏 + 滚动容器
  // PageShell 走自然流（不再 height:100%/overflow:hidden），避免双滚动嵌套
  if (isHolodeck) {
    return (
      <div className="page" style={{ display: 'block', background: 'transparent', height: 'auto', overflow: 'visible' }}>
        {(right || subtitle) && (
          <div style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid rgba(120, 200, 255, 0.1)',
          }}>
            {subtitle && (
              <div className="hd-text-mono" style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                flex: 1,
                letterSpacing: '0.05em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {subtitle}
              </div>
            )}
            {right && <div style={{ flexShrink: 0 }}>{right}</div>}
          </div>
        )}
        <div style={{ padding: '12px' }}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      className="page"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{
        flexShrink: 0,
        zIndex: 100,
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        paddingTop: 'env(safe-area-inset-top)',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: 'env(safe-area-inset-top) 8px 0 8px',
        minHeight: 52
      }}>
        {onBack && (
          <div
            onClick={() => { hapticLight(); onBack() }}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '10px 8px',
              cursor: 'pointer',
              color: 'var(--accent-blue)',
              fontSize: 14,
              gap: 2,
              userSelect: 'none'
            }}
          >
            <LeftOutline fontSize={18} />
            <span style={{ fontSize: 13 }}>返回</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, padding: onBack ? 0 : '0 4px' }}>
          <div style={{
            fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: 1.2
          }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subtitle}
            </div>
          )}
        </div>
        {right && <div style={{ padding: '0 8px', flexShrink: 0 }}>{right}</div>}
      </div>
      {flex ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '16px' }}>
          {children}
        </div>
      )}
    </div>
  )
}
