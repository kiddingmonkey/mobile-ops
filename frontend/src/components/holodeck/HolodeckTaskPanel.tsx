import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { withCache, getCache } from '@/utils/apiCache'
import { fmtRelative } from '@/utils/format'
import { hapticLight } from '@/utils/haptics'
import { Badge } from './achievements'
import AlertInspector from './AlertInspector'

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
  const [inspectAlert, setInspectAlert] = useState<any | null>(null)

  const load = () => {
    withCache('alerts_50', () => api.listAlerts(50)).then(a => setAlerts(a || [])).catch(() => {})
    withCache('ops_10', () => api.listOperations(10)).then(o => setOps(o || [])).catch(() => {})
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

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
            onOpen={() => { hapticLight(); setInspectAlert(a) }}
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

      {inspectAlert && (
        <AlertInspector
          alert={inspectAlert}
          onClose={() => { setInspectAlert(null); load() }}
          onStrike={onStrike}
          onBadgesUnlocked={onBadgesUnlocked}
        />
      )}
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

function AlertCard({ alert, onOpen }: { alert: any; onOpen: () => void }) {
  const color = SEVERITY_COLOR[alert.severity] || 'var(--hd-cyan)'
  const name = alert.labels?.alertname || alert.name || 'Unknown'
  const cluster = alert.labels?.cluster || ''
  return (
    <div
      onClick={onOpen}
      style={{
        background: 'rgba(10, 20, 45, 0.5)',
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        padding: '8px 10px',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 4,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {name}
        </div>
        <div className="hd-text-mono" style={{ fontSize: 9, color, letterSpacing: '0.1em', flexShrink: 0 }}>
          {(alert.severity || '').toUpperCase()}
        </div>
      </div>
      <div className="hd-text-mono" style={{
        fontSize: 9,
        color: 'var(--text-tertiary)',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>{cluster || 'N/A'}</span>
        <span>{fmtRelative(alert.starts_at || alert.startsAt)}</span>
      </div>
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
