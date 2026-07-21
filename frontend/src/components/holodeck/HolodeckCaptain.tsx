import { useEffect, useState } from 'react'
import { SILHOUETTES, SilhouetteId } from './CaptainSilhouettes'
import CaptainConfigSheet from './CaptainConfigSheet'

interface CaptainConfig {
  name: string
  callsign: string
  silhouette?: SilhouetteId
  portraitUrl?: string
}

export const CAPTAIN_STORAGE_KEY = 'holodeck_captain_v2'

function loadCaptain(): CaptainConfig {
  try {
    const saved = localStorage.getItem(CAPTAIN_STORAGE_KEY)
    if (saved) return { silhouette: 'lyra', ...JSON.parse(saved) }
  } catch {}
  const s = SILHOUETTES.lyra
  return { name: s.name, callsign: s.callsign, silhouette: 'lyra' }
}

type Mood = 'calm' | 'alert' | 'combat'

function moodDialogue(mood: Mood, criticals: number, warnings: number, name: string): string {
  if (mood === 'combat') {
    return `${criticals} 项红色警报，指挥官。全员已就位，请下令。`
  }
  if (mood === 'alert') {
    return warnings > 0
      ? `${warnings} 项异常波动记录在案，建议尽快复核。`
      : '数据流出现轻微扰动，我会持续追踪。'
  }
  const hour = new Date().getHours()
  if (hour < 6) return '夜航时段，指挥官。要不要来杯合成咖啡？'
  if (hour < 12) return '晨间巡航正常，所有系统在线。'
  if (hour < 18) return `当前航向稳定，${name.split('·')[0] || '本舰'}持续待命。`
  return '今日辛苦了，指挥官。星域已归于宁静。'
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
  const [captain, setCaptain] = useState<CaptainConfig>(() => loadCaptain())
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    const onStorage = () => setCaptain(loadCaptain())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const dialogue = moodDialogue(mood, criticals, warnings, captain.name)
  const Silhouette = captain.silhouette && SILHOUETTES[captain.silhouette]
    ? SILHOUETTES[captain.silhouette].Component
    : SILHOUETTES.lyra.Component

  return (
    <>
      <div className="hd-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="hd-panel-header">
          <span>◆ CAPTAIN</span>
          <span
            className="hd-text-mono"
            style={{ fontSize: 10, opacity: 0.8, cursor: 'pointer', letterSpacing: '0.15em' }}
            onClick={() => setShowConfig(true)}
          >
            {captain.callsign} ▸
          </span>
        </div>
        <div className="hd-panel-corner tl" />
        <div className="hd-panel-corner tr" />
        <div className="hd-panel-corner bl" />
        <div className="hd-panel-corner br" />

        <div
          onClick={() => setShowConfig(true)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            position: 'relative',
            padding: '12px 8px 0',
            minHeight: 0,
            cursor: 'pointer',
          }}
        >
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
            <Silhouette />
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

      {showConfig && (
        <CaptainConfigSheet
          current={captain}
          onSave={(next) => {
            setCaptain(next)
            localStorage.setItem(CAPTAIN_STORAGE_KEY, JSON.stringify(next))
            setShowConfig(false)
          }}
          onClose={() => setShowConfig(false)}
        />
      )}
    </>
  )
}
