import { useTheme } from '@/store'

export default function HolodeckRotateHint() {
  const setMode = useTheme(s => s.setMode)

  return (
    <div className="hd-rotate-hint">
      <svg viewBox="0 0 100 100" fill="none">
        <rect x="30" y="18" width="40" height="64" rx="6" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="50" cy="74" r="2" fill="currentColor" />
        <path
          d="M 20 50 Q 15 30 30 25"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="3 3"
        />
        <polygon points="27,22 32,27 27,32" fill="currentColor" />
      </svg>

      <div className="hd-text-glow hd-text-mono" style={{
        fontSize: 14,
        letterSpacing: '0.3em',
        textAlign: 'center',
      }}>
        ROTATE TO LANDSCAPE
      </div>
      <div style={{
        fontSize: 13,
        color: 'var(--text-secondary)',
        textAlign: 'center',
        maxWidth: 300,
        lineHeight: 1.6,
      }}>
        全息舰桥需要横屏才能展开<br />
        请将设备横向放置
      </div>

      <button
        className="hd-btn"
        onClick={() => setMode('dark')}
        style={{ marginTop: 8 }}
      >
        退出全息模式
      </button>
    </div>
  )
}
