import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { withCache } from '@/utils/apiCache'
import HolodeckCaptain from './HolodeckCaptain'
import HolodeckStarfield from './HolodeckStarfield'
import HolodeckTaskPanel from './HolodeckTaskPanel'
import HolodeckStarBackground from './HolodeckStarBackground'
import HolodeckRotateHint from './HolodeckRotateHint'
import HealthReminder from './HealthReminder'
import BadgeWall from './BadgeWall'
import BadgeUnlockToast from './BadgeUnlockToast'
import { Badge, recordEvent } from './achievements'

type Mood = 'calm' | 'alert' | 'combat'

export default function HolodeckLayout() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  )
  const [showBadgeWall, setShowBadgeWall] = useState(false)
  const [newBadges, setNewBadges] = useState<Badge[]>([])

  // 进入 Holodeck 首次触发徽章
  useEffect(() => {
    const unlocked = recordEvent({ type: 'holodeck_entered' })
    if (unlocked.length) setNewBadges(unlocked)
  }, [])

  useEffect(() => {
    const check = () => {
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait')
    }
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  useEffect(() => {
    const load = () => {
      withCache('alerts_50', () => api.listAlerts(50))
        .then(a => setAlerts(a || []))
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const { criticals, warnings, mood } = useMemo(() => {
    const firing = alerts.filter(a => a.status === 'firing')
    const c = firing.filter(a => a.severity === 'critical').length
    const w = firing.filter(a => a.severity === 'warning').length
    let m: Mood = 'calm'
    if (c > 0) m = 'combat'
    else if (w > 0) m = 'alert'
    return { criticals: c, warnings: w, mood: m }
  }, [alerts])

  // 紧急模式 body class
  useEffect(() => {
    if (mood === 'combat') {
      document.body.classList.add('hd-emergency')
    } else {
      document.body.classList.remove('hd-emergency')
    }
    return () => document.body.classList.remove('hd-emergency')
  }, [mood])

  if (orientation === 'portrait') {
    return <HolodeckRotateHint />
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: 'var(--text-primary)',
    }}>
      <HolodeckStarBackground />

      {/* 顶部指挥条 */}
      <TopCommandBar
        mood={mood}
        criticals={criticals}
        warnings={warnings}
        onOpenBadges={() => setShowBadgeWall(true)}
      />

      {/* 三列主区域 */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '22% 1fr 26%',
        gap: 8,
        padding: '8px 12px 12px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div className={mood === 'combat' ? 'hd-non-critical' : ''}>
          <HolodeckCaptain mood={mood} criticals={criticals} warnings={warnings} />
        </div>
        <HolodeckStarfield
          onSelectCluster={(id) => {
            const unlocked = recordEvent({ type: 'cluster_selected', clusterId: id })
            if (unlocked.length) setNewBadges(prev => [...prev, ...unlocked])
          }}
        />
        <HolodeckTaskPanel />
      </div>

      <HealthReminder emergency={mood === 'combat'} />

      {showBadgeWall && <BadgeWall onClose={() => setShowBadgeWall(false)} />}

      <BadgeUnlockToast badges={newBadges} onDismiss={() => setNewBadges([])} />
    </div>
  )
}

function TopCommandBar({
  mood,
  criticals,
  warnings,
  onOpenBadges,
}: {
  mood: Mood
  criticals: number
  warnings: number
  onOpenBadges: () => void
}) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const statusColor = mood === 'combat' ? 'var(--hd-emergency)' : mood === 'alert' ? 'var(--warning)' : 'var(--success)'
  const statusText = mood === 'combat' ? 'RED ALERT' : mood === 'alert' ? 'CAUTION' : 'NOMINAL'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      borderBottom: '1px solid rgba(120, 200, 255, 0.15)',
      background: 'rgba(3, 5, 16, 0.6)',
      backdropFilter: 'blur(12px)',
      position: 'relative',
      zIndex: 2,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="hd-text-glow hd-text-mono" style={{
          fontSize: 13,
          letterSpacing: '0.35em',
          fontWeight: 700,
        }}>
          ◆ CLOUDPILOT · BRIDGE
        </div>
        <div className="hd-text-mono" style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.15em',
        }}>
          v1.1.1
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* 状态指示 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 8px ${statusColor}`,
            animation: mood === 'combat' ? 'hd-breathe 0.8s ease-in-out infinite' : 'hd-breathe 3s ease-in-out infinite',
          }} />
          <span className="hd-text-mono" style={{
            fontSize: 11,
            color: statusColor,
            letterSpacing: '0.2em',
            fontWeight: 600,
          }}>
            {statusText}
          </span>
        </div>

        {/* 告警计数 */}
        {(criticals > 0 || warnings > 0) && (
          <div className="hd-text-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {criticals > 0 && <span style={{ color: 'var(--hd-emergency)' }}>{criticals}C </span>}
            {warnings > 0 && <span style={{ color: 'var(--warning)' }}>{warnings}W</span>}
          </div>
        )}

        {/* 徽章墙入口 */}
        <button
          onClick={onOpenBadges}
          className="hd-text-mono"
          style={{
            background: 'transparent',
            border: '1px solid rgba(120, 200, 255, 0.3)',
            color: 'var(--hd-cyan)',
            padding: '4px 10px',
            fontSize: 10,
            letterSpacing: '0.15em',
            cursor: 'pointer',
            borderRadius: 2,
            fontFamily: 'inherit',
          }}
        >
          ◆ GALLERY
        </button>

        {/* 时间 */}
        <div className="hd-text-mono hd-text-glow" style={{
          fontSize: 13,
          letterSpacing: '0.15em',
          minWidth: 100,
          textAlign: 'right',
        }}>
          {time.toTimeString().slice(0, 8)}
        </div>
      </div>
    </div>
  )
}
