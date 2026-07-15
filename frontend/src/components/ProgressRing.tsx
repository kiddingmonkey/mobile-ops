interface Props {
  value: number    // 0-100
  size?: number
  strokeWidth?: number
  color?: string
  bgColor?: string
  label?: string
  sublabel?: string
}

export default function ProgressRing({
  value, size = 80, strokeWidth = 7, color, bgColor, label, sublabel
}: Props) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(Math.max(value, 0), 100) / 100) * circ
  const autoColor = value > 85 ? 'var(--danger)' : value > 60 ? 'var(--warning)' : 'var(--success)'
  const fill = color || autoColor

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={bgColor || 'var(--bg-elevated)'}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={fill}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{
          fontSize: size * 0.22, fontWeight: 700,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums'
        }}>{label ?? `${Math.round(value)}%`}</span>
        {sublabel && (
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>{sublabel}</span>
        )}
      </div>
    </div>
  )
}
