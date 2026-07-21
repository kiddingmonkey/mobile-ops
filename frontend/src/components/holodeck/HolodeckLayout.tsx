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
import QuickCommandDrawer from './QuickCommandDrawer'
import ClusterInspector from './ClusterInspector'
import OrbitalStrike from './OrbitalStrike'
import BridgeTicker, { pushBridgeEvent } from './BridgeTicker'
import GlassShatter from './GlassShatter'
import BootSequence, { shouldPlayBoot } from './BootSequence'
import FullBridgeLog from './FullBridgeLog'
import GalaxyOverview from './GalaxyOverview'
import { fireCaptainReaction } from './captainReactions'
import { Badge, recordEvent } from './achievements'
import { playSoundscape, getCurrentScape, getCurrentVolume } from './soundscape'

type Mood = 'calm' | 'alert' | 'combat'

export default function HolodeckLayout() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  )
  const [showBadgeWall, setShowBadgeWall] = useState(false)
  const [showQuickCmd, setShowQuickCmd] = useState(false)
  const [newBadges, setNewBadges] = useState<Badge[]>([])
  const [inspectCluster, setInspectCluster] = useState<{ id: number; name: string } | null>(null)
  const [strike, setStrike] = useState<{ x: number; y: number; color?: string } | null>(null)
  const [booting, setBooting] = useState(() => shouldPlayBoot())
  const [showFullLog, setShowFullLog] = useState(false)
  const [showGalaxy, setShowGalaxy] = useState(false)

  // 进入 Holodeck 首次触发徽章 + 欢迎日志
  useEffect(() => {
    const unlocked = recordEvent({ type: 'holodeck_entered' })
    if (unlocked.length) setNewBadges(unlocked)
    pushBridgeEvent('info', 'BRIDGE ONLINE · 全息舰桥已激活')
  }, [])

  // 恢复上次的环境音景（需要用户交互后才能启动 AudioContext）
  useEffect(() => {
    const scape = getCurrentScape()
    if (scape === 'off') return
    const unlock = () => {
      playSoundscape(scape, getCurrentVolume())
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // 从右边缘右滑呼出快速指令
  useEffect(() => {
    let startX = 0
    let startY = 0
    let tracking = false
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t.clientX > window.innerWidth - 30) {
        startX = t.clientX
        startY = t.clientY
        tracking = true
      }
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      const dx = startX - t.clientX
      const dy = Math.abs(startY - t.clientY)
      if (dx > 40 && dy < 40) {
        setShowQuickCmd(true)
        tracking = false
      }
    }
    const onEnd = () => { tracking = false }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
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
        onOpenLog={() => setShowFullLog(true)}
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
          onSelectCluster={(id, name) => {
            const unlocked = recordEvent({ type: 'cluster_selected', clusterId: id })
            if (unlocked.length) setNewBadges(prev => [...prev, ...unlocked])
            const displayName = name || `cluster-${id}`
            setInspectCluster({ id, name: displayName })
            fireCaptainReaction({ type: 'cluster_selected', clusterName: displayName })
          }}
          onCoreClick={() => setShowGalaxy(true)}
        />
        <HolodeckTaskPanel
          onBadgesUnlocked={(b) => setNewBadges(prev => [...prev, ...b])}
          onStrike={(x, y, color) => setStrike({ x, y, color })}
        />
      </div>

      <HealthReminder emergency={mood === 'combat'} />

      {showBadgeWall && <BadgeWall onClose={() => setShowBadgeWall(false)} />}

      <BadgeUnlockToast badges={newBadges} onDismiss={() => setNewBadges([])} />

      <QuickCommandDrawer open={showQuickCmd} onClose={() => setShowQuickCmd(false)} />

      {inspectCluster && (
        <ClusterInspector
          clusterId={inspectCluster.id}
          clusterName={inspectCluster.name}
          onClose={() => setInspectCluster(null)}
          onStrike={(x, y, color) => setStrike({ x, y, color })}
          onBadgesUnlocked={(b) => setNewBadges(prev => [...prev, ...b])}
        />
      )}

      {/* 底部系统日志 ticker */}
      <BridgeTicker alerts={alerts} />

      {/* P0 玻璃碎裂效果 */}
      <GlassShatter active={mood === 'combat'} />

      {/* 轨道打击动画 */}
      <OrbitalStrike
        active={!!strike}
        x={strike?.x ?? 50}
        y={strike?.y ?? 50}
        color={strike?.color}
        onDone={() => setStrike(null)}
      />

      {/* 右边缘触发提示 + 点击呼出 */}
      <div
        onClick={() => setShowQuickCmd(true)}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 20,
          height: 80,
          background: 'linear-gradient(90deg, transparent 0%, rgba(79,195,247,0.15) 100%)',
          borderLeft: '2px solid var(--hd-cyan)',
          cursor: 'pointer',
          zIndex: 990,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'hd-breathe 2.5s ease-in-out infinite',
        }}
        title="呼出快速指令"
      >
        <span style={{ color: 'var(--hd-cyan)', fontSize: 10 }}>◀</span>
      </div>

      {/* 左侧舰长立绘侧栏 */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 40,
        bottom: 40,
        width: 220,
        background: 'linear-gradient(90deg, rgba(3,5,16,0.85) 0%, transparent 100%)',
        borderRight: '1px solid rgba(79,195,247,0.2)',
        zIndex: 1,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 40,
        overflow: 'hidden',
      }}>
        <img
          src="/images/captain.png"
          alt="Captain"
          style={{
            maxWidth: '100%',
            maxHeight: 'calc(100% - 40px)',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 20px rgba(79,195,247,0.4))',
            opacity: 0.9,
          }}
        />
        <div style={{
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.25em',
          color: 'var(--hd-cyan)',
          marginTop: 8,
          textShadow: '0 0 8px var(--hd-cyan)',
          flexShrink: 0,
        }}>
          ◆ COMMANDER
        </div>
      </div>

      {/* 完整航行日志 */}
      {showFullLog && <FullBridgeLog onClose={() => setShowFullLog(false)} />}

      {/* 星系总览（点中央恒星弹出） */}
      {showGalaxy && (
        <GalaxyOverview
          onClose={() => setShowGalaxy(false)}
          onEnterCluster={(id, name) => {
            setInspectCluster({ id, name })
            fireCaptainReaction({ type: 'cluster_selected', clusterName: name })
          }}
        />
      )}

      {/* 首次进入启动序列（最顶层） */}
      {booting && <BootSequence onDone={() => setBooting(false)} />}
    </div>
  )
}

function TopCommandBar({
  mood,
  criticals,
  warnings,
  onOpenBadges,
  onOpenLog,
}: {
  mood: Mood
  criticals: number
  warnings: number
  onOpenBadges: () => void
  onOpenLog: () => void
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
          ◆ STARDECK · 星驾
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

        {/* 航行日志入口 */}
        <button
          onClick={onOpenLog}
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
          ◆ LOG
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
