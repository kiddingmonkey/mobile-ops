import { ReactNode } from 'react'

interface Item {
  label: string
  value: string | number
  color?: string
  icon?: ReactNode
}

interface Props {
  items: Item[]
  columns?: number
}

export default function StatCard({ items, columns }: Props) {
  const cols = columns || items.length
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 8
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          textAlign: 'center',
          padding: '14px 8px',
          background: 'var(--bg-secondary)',
          borderRadius: 12
        }}>
          {it.icon && <div style={{ marginBottom: 4 }}>{it.icon}</div>}
          <div style={{
            fontSize: 22, fontWeight: 700,
            color: it.color || 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2
          }}>{it.value}</div>
          <div style={{
            fontSize: 11, color: 'var(--text-tertiary)',
            marginTop: 4, fontWeight: 500
          }}>{it.label}</div>
        </div>
      ))}
    </div>
  )
}
