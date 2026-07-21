import { useMemo } from 'react'

interface CaptainConfig {
  name: string
  callsign: string
  portraitUrl?: string
}

const DEFAULT_CAPTAINS: CaptainConfig[] = [
  { name: '星舰之心·璃', callsign: 'LYRA-01' },
  { name: '苍穹指挥官·澪', callsign: 'MIO-07' },
  { name: '深空之影·绯', callsign: 'SCARLET' },
]

function getCaptain(): CaptainConfig {
  try {
    const saved = localStorage.getItem('holodeck_captain')
    if (saved) return JSON.parse(saved)
  } catch {}
  return DEFAULT_CAPTAINS[0]
}

type Mood = 'calm' | 'alert' | 'combat'

function moodDialogue(mood: Mood, criticals: number, warnings: number): string {
  if (mood === 'combat') {
    return `检测到 ${criticals} 项红色警报，指挥官，请下达指令。`
  }
  if (mood === 'alert') {
    return warnings > 0
      ? `${warnings} 项异常波动记录在案，建议尽快复核。`
      : '系统数据流出现轻微扰动，我会持续追踪。'
  }
  const hour = new Date().getHours()
  if (hour < 6) return '夜航时段，指挥官。要不要来杯合成咖啡？'
  if (hour < 12) return '晨间巡航正常，所有系统在线。'
  if (hour < 18) return '当前航向稳定，星域一切安好。'
  return '今日辛苦了，指挥官。要不要看看今天的成就日志？'
}

export default function HolodeckCaptain({
  mood,
  criticals,
  warnings,
}: {
  mood: Mood
  criticals: number
  warnings: number
}) {
  const captain = useMemo(() => getCaptain(), [])
  const dialogue = moodDialogue(mood, criticals, warnings)

  return (
    <div className="hd-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="hd-panel-header">
        <span>◆ CAPTAIN</span>
        <span className="hd-text-mono" style={{ fontSize: 10, opacity: 0.7 }}>{captain.callsign}</span>
      </div>
      <div className="hd-panel-corner tl" />
      <div className="hd-panel-corner tr" />
      <div className="hd-panel-corner bl" />
      <div className="hd-panel-corner br" />

      {/* 立绘区域 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        position: 'relative',
        padding: '12px 8px 0',
        minHeight: 0,
      }}>
        {/* 全息底座光环 */}
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: 40,
          background: 'radial-gradient(ellipse, var(--hd-cyan-glow) 0%, transparent 70%)',
          filter: 'blur(6px)',
          animation: 'hd-breathe 3s ease-in-out infinite',
        }} />

        {captain.portraitUrl ? (
          <img
            src={captain.portraitUrl}
            alt={captain.name}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 20px var(--hd-cyan-glow))',
              animation: 'hd-breathe 4s ease-in-out infinite',
              position: 'relative',
              zIndex: 1,
            }}
          />
        ) : (
          <CaptainSilhouette />
        )}

        {/* 扫描线 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(79,195,247,0.04) 3px, rgba(79,195,247,0.04) 4px)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* 台词气泡 */}
      <div style={{
        margin: '8px 12px 12px',
        padding: '10px 12px',
        background: 'rgba(79, 195, 247, 0.08)',
        borderLeft: '2px solid var(--hd-cyan)',
        borderRadius: '2px',
        fontSize: 12,
        color: 'var(--text-primary)',
        lineHeight: 1.55,
        position: 'relative',
      }}>
        <div style={{
          fontSize: 10,
          letterSpacing: '0.2em',
          color: 'var(--hd-cyan)',
          textShadow: '0 0 6px var(--hd-cyan-glow)',
          marginBottom: 4,
        }}>
          {captain.name}
        </div>
        <div>{dialogue}</div>
      </div>
    </div>
  )
}

function CaptainSilhouette() {
  return (
    <svg
      viewBox="0 0 200 320"
      style={{
        height: '100%',
        maxHeight: '100%',
        filter: 'drop-shadow(0 0 12px var(--hd-cyan-glow))',
        animation: 'hd-breathe 4s ease-in-out infinite',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <defs>
        <linearGradient id="captain-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(79,195,247,0.9)" />
          <stop offset="50%" stopColor="rgba(232,121,249,0.7)" />
          <stop offset="100%" stopColor="rgba(79,195,247,0.3)" />
        </linearGradient>
      </defs>
      {/* 头部 */}
      <ellipse cx="100" cy="55" rx="26" ry="30" fill="none" stroke="url(#captain-grad)" strokeWidth="1.5" />
      {/* 长发 */}
      <path
        d="M74,60 Q60,120 55,200 Q60,240 70,260 M126,60 Q140,120 145,200 Q140,240 130,260"
        fill="none"
        stroke="url(#captain-grad)"
        strokeWidth="1.5"
      />
      {/* 肩甲 */}
      <path
        d="M60,110 Q100,100 140,110 L145,140 Q100,130 55,140 Z"
        fill="none"
        stroke="url(#captain-grad)"
        strokeWidth="1.5"
      />
      {/* 身体线条 */}
      <path
        d="M75,140 L70,240 L80,300 M125,140 L130,240 L120,300"
        fill="none"
        stroke="url(#captain-grad)"
        strokeWidth="1.5"
      />
      {/* 胸前装饰徽章 */}
      <circle cx="100" cy="170" r="6" fill="none" stroke="var(--hd-cyan)" strokeWidth="1" opacity="0.8" />
      <circle cx="100" cy="170" r="2" fill="var(--hd-cyan)" opacity="0.9">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* 装饰线 */}
      <line x1="85" y1="185" x2="115" y2="185" stroke="url(#captain-grad)" strokeWidth="1" opacity="0.6" />
    </svg>
  )
}
