import { ReactNode } from 'react'
import { NavBar } from 'antd-mobile'

interface Props {
  title: string
  onBack?: () => void
  right?: ReactNode
  children: ReactNode
}

export default function PageShell({ title, onBack, right, children }: Props) {
  return (
    <div className="page">
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        paddingTop: 'env(safe-area-inset-top)'
      }}>
        <NavBar
          back={onBack ? '' : null}
          onBack={onBack}
          right={right}
          style={{ '--height': '52px' } as any}
        >{title}</NavBar>
      </div>
      <div className="page-content">
        {children}
      </div>
    </div>
  )
}
