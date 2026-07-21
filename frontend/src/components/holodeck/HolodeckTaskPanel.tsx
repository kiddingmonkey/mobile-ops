import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { api, friendlyApiError } from '@/api/client'
import { withCache, getCache } from '@/utils/apiCache'
import { fmtRelative } from '@/utils/format'
import { hapticLight } from '@/utils/haptics'
import HoldToConfirm from './HoldToConfirm'
import { recordEvent, Badge } from './achievements'
import { pushBridgeEvent } from './BridgeTicker'

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--hd-emergency)',
  warning: 'var(--warning)',
  info: 'var(--hd-cyan)',
}

export default function HolodeckTaskPanel({
  onBadgesUnlocked,
  onStrike,
}: {
  onBadgesUnlocked?: (b: Badge[]) => void
  onStrike?: (x: number, y: number, color?: string) => void
}) {
  const nav = useNavigate()
  const [alerts, setAlerts] = useState<any[]>(() => getCache('alerts_50') || [])
  const [ops, setOps] = useState<any[]>(() => getCache('ops_10') || [])
  const [tab, setTab] = useState<'alerts' | 'ops'>('alerts')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [silencing, setSilencing] = useState<string | null>(null)

  const load = () => {
    withCache('alerts_50', () => api.listAlerts(50)).then(a => setAlerts(a || [])).catch(() => {})
    withCache('ops_10', () => api.listOperations(10)).then(o => setOps(o || [])).catch(() => {})
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const silenceAlert = async (alert: any, targetX: number, targetY: number) => {
    const alertname = alert.labels?.alertname || alert.name
    if (!alertname) return
    setSilencing(alert.id)
    Toast.show({ icon: 'loading', content: '静默中...', duration: 0 })

    // 立即触发轨道打击（不等 API）
    const strikeColor = alert.severity === 'critical' ? 'var(--hd-emergency)' : 'var(--warning)'
    onStrike?.(targetX, targetY, strikeColor)

    try {
      const now = new Date()
      const endsAt = new Date(now.getTime() + 60 * 60 * 1000) // 1 小时
      await api.createSilence(1, {
        matchers: [{ name: 'alertname', value: alertname, isRegex: false, isEqual: true }],
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        createdBy: 'holodeck',
        comment: '全息舰桥·蓄力静默 1h',
      })
      Toast.clear()
      Toast.show({ icon: 'success', content: '星域已清理' })

      pushBridgeEvent('success', `SILENCED · ${alertname} · 1h`)

      const unlocked = recordEvent({ type: 'alert_resolved', severity: alert.severity })
      if (unlocked.length) onBadgesUnlocked?.(unlocked)

      load()
      setExpandedId(null)
    } catch (e) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
      pushBridgeEvent('error', `SILENCE FAILED · ${alertname}`)
    } finally {
      setSilencing(null)
    }
  }

  const firing = alerts.filter(a => a.status === 'firing')
  const criticals = firing.filter(a => a.severity === 'critical')
  const warnings = firing.filter(a => a.severity === 'warning')
  const running = ops.filter(o => ['executing', 'polling', 'pending', 'prechecking'].includes(o.status))

  return (
    <div className="hd-panel" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div className="hd-panel-header">
        <span>◆ MISSION BRIEF</span>
        <span className="hd-text-mono" style={{ fontSize: 10, opacity: 0.7 }}>
          {criticals.length}C · {warnings.length}W · {running.length}R
        </span>
      </div>
      <div className="hd-panel-corner tl" />
      <div className="hd-panel-corner tr" />
      <div className="hd-panel-corner bl" />
      <div className="hd-panel-corner br" />

      {/* Tab 切换 */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(120, 200, 255, 0.15)',
        flexShrink: 0,
      }}>
        <TabBtn active={tab === 'alerts'} onClick={() => setTab('alerts')}>
          告警 <span style={{ color: 'var(--hd-emergency)' }}>{firing.length}</span>
        </TabBtn>
        <TabBtn active={tab === 'ops'} onClick={() => setTab('ops')}>
          任务 <span style={{ color: 'var(--hd-cyan)' }}>{running.length}</span>
        </TabBtn>
      </div>

      {/* 列表 */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {tab === 'alerts' && firing.length === 0 && (
          <EmptyState text="ALL SYSTEMS NOMINAL" sub="星域一切安好" />
        )}
        {tab === 'ops' && running.length === 0 && (
          <EmptyState text="NO ACTIVE MISSIONS" sub="等待新指令" />
        )}

        {tab === 'alerts' && firing.map(a => (
          <AlertCard
            key={a.id}
            alert={a}
            expanded={expandedId === a.id}
            silencing={silencing === a.id}
            onToggle={() => {
              hapticLight()
              setExpandedId(expandedId === a.id ? null : a.id)
            }}
            onOpen={() => { hapticLight(); nav(`/alerts?id=${a.id}`) }}
            onSilence={(x, y) => silenceAlert(a, x, y)}
          />
        ))}
        {tab === 'ops' && running.map(o => (
          <OpCard key={o.id} op={o} onClick={() => { hapticLight(); nav(`/tasks?id=${o.id}`) }} />
        ))}
      </div>

      {/* 底部快捷 */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '6px 8px 8px',
        flexShrink: 0,
      }}>
        <button className="hd-btn" style={{ flex: 1, fontSize: 10 }} onClick={() => nav('/diagnose')}>
          DIAG
        </button>
        <button className="hd-btn" style={{ flex: 1, fontSize: 10 }} onClick={() => nav('/tasks')}>
          TASKS
        </button>
        <button className="hd-btn" style={{ flex: 1, fontSize: 10 }} onClick={() => nav('/settings')}>
          CONFIG
        </button>
      </div>
    </div>
  )
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: 'transparent',
        border: 'none',
        color: active ? 'var(--hd-cyan)' : 'var(--text-tertiary)',
        padding: '10px 8px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        textShadow: active ? '0 0 8px var(--hd-cyan-glow)' : 'none',
        borderBottom: active ? '2px solid var(--hd-cyan)' : '2px solid transparent',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function AlertCard({
  alert,
  expanded,
  silencing,
  onToggle,
  onOpen,
  onSilence,
}: {
  alert: any
  expanded: boolean
  silencing: boolean
  onToggle: () => void
  onOpen: () => void
  onSilence: (x: number, y: number) => void
}) {
  const targetRef = useRef<HTMLDivElement>(null)

  const handleConfirm = () => {
    const el = targetRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const x = ((r.left + r.width / 2) / window.innerWidth) * 100
      const y = ((r.top + r.height / 2) / window.innerHeight) * 100
      onSilence(x, y)
    } else {
      onSilence(75, 50) // 右侧兜底
    }
  }
  const color = SEVERITY_COLOR[alert.severity] || 'var(--hd-cyan)'
  const name = alert.labels?.alertname || alert.name || 'Unknown'
  const cluster = alert.labels?.cluster || ''
  return (
    <div
      ref={targetRef}
      style={{
        background: expanded ? 'rgba(10, 20, 45, 0.75)' : 'rgba(10, 20, 45, 0.5)',
        border: `1px solid ${color}${expanded ? '80' : '40'}`,
        borderLeft: `3px solid ${color}`,
        padding: '8px 10px',
        borderRadius: 2,
        boxShadow: expanded ? `0 0 16px ${color}44` : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: expanded ? 4 : 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {name}
        </div>
        <div className="hd-text-mono" style={{ fontSize: 9, color, letterSpacing: '0.1em', flexShrink: 0 }}>
          {(alert.severity || '').toUpperCase()}
        </div>
      </div>
      <div
        onClick={onToggle}
        className="hd-text-mono"
        style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          display: 'flex',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <span>{cluster || 'N/A'}</span>
        <span>{fmtRelative(alert.starts_at || alert.startsAt)}</span>
      </div>

      {expanded && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px dashed ${color}40`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <HoldToConfirm
            label="HOLD · 静默 1h"
            duration={1600}
            color={color}
            glowColor={color}
            onConfirm={handleConfirm}
            disabled={silencing}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              className="hd-btn"
              onClick={(e) => { e.stopPropagation(); onOpen() }}
              style={{ fontSize: 10, width: '100%' }}
            >
              VIEW DETAIL
            </button>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
              长按左侧充能环 1.6s 静默此告警一小时
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OpCard({ op, onClick }: { op: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(10, 20, 45, 0.5)',
        border: '1px solid rgba(79, 195, 247, 0.25)',
        borderLeft: '3px solid var(--hd-cyan)',
        padding: '8px 10px',
        cursor: 'pointer',
        borderRadius: 2,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
          {op.type || 'Operation'}
        </div>
        <div className="hd-text-mono" style={{ fontSize: 9, color: 'var(--hd-cyan)' }}>
          {(op.status || '').toUpperCase()}
        </div>
      </div>
      <div className="hd-text-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
        {fmtRelative(op.created_at || op.createdAt)}
      </div>
    </div>
  )
}

function EmptyState({ text, sub }: { text: string; sub: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '32px 12px',
      color: 'var(--text-tertiary)',
    }}>
      <div className="hd-text-mono hd-text-glow" style={{ fontSize: 11, letterSpacing: '0.25em', marginBottom: 6 }}>
        ◇ {text}
      </div>
      <div style={{ fontSize: 11 }}>{sub}</div>
    </div>
  )
}
