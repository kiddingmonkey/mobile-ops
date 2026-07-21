import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { fmtRelative } from '@/utils/format'
import PanelShell from './PanelShell'
import AlertInspector from '@/components/holodeck/AlertInspector'

const SEV_COLOR: Record<string, string> = {
  critical: '#ff3b5c',
  warning: '#fbbf24',
  info: '#4fc3f7',
}

export default function AlertsPanel({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [alerts, setAlerts] = useState<any[]>([])
  const [tab, setTab] = useState<'firing' | 'resolved'>('firing')
  const [inspect, setInspect] = useState<any | null>(null)

  useEffect(() => {
    api.listAlerts(100).then(a => setAlerts(a || [])).catch(() => {})
  }, [])

  const filtered = alerts.filter(a => tab === 'firing' ? a.status === 'firing' : a.status === 'resolved')
  const criticals = filtered.filter(a => a.severity === 'critical')
  const others = filtered.filter(a => a.severity !== 'critical')

  return (
    <>
      <PanelShell title="警报中心" titleEn="ALERTS" color="#ff2d92" onClose={onClose}>
        {/* Tab */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,45,146,0.25)', flexShrink: 0 }}>
          <TabBtn active={tab === 'firing'} onClick={() => setTab('firing')} color="#ff2d92">
            FIRING · 生效 ({alerts.filter(a => a.status === 'firing').length})
          </TabBtn>
          <TabBtn active={tab === 'resolved'} onClick={() => setTab('resolved')} color="#4ade80">
            RESOLVED · 已解决
          </TabBtn>
          <button
            onClick={() => nav('/alerts')}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#4fc3f7',
              padding: '10px 16px',
              fontSize: 10,
              letterSpacing: '0.2em',
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer',
            }}
          >
            全屏 →
          </button>
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {criticals.length > 0 && (
            <>
              <SectionLabel color="#ff3b5c">CRITICAL · 紧急 ({criticals.length})</SectionLabel>
              {criticals.map(a => <AlertCard key={a.id || a.alertname} alert={a} onOpen={() => setInspect(a)} />)}
            </>
          )}
          {others.length > 0 && (
            <>
              <SectionLabel color="#fbbf24">OTHERS · 其他 ({others.length})</SectionLabel>
              {others.map(a => <AlertCard key={a.id || a.alertname} alert={a} onOpen={() => setInspect(a)} />)}
            </>
          )}
          {filtered.length === 0 && (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'rgba(220,240,255,0.5)',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.2em',
              fontSize: 12,
            }}>
              ◇ ALL SYSTEMS NOMINAL<br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>星域一切安好</span>
            </div>
          )}
        </div>
      </PanelShell>

      {inspect && (
        <AlertInspector
          alert={inspect}
          onClose={() => setInspect(null)}
        />
      )}
    </>
  )
}

function TabBtn({ children, active, onClick, color }: { children: React.ReactNode; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: active ? color : 'rgba(220,240,255,0.5)',
        padding: '10px 16px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.15em',
        cursor: 'pointer',
        fontFamily: "'JetBrains Mono', monospace",
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
        textShadow: active ? `0 0 6px ${color}` : 'none',
      }}
    >
      {children}
    </button>
  )
}

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10,
      letterSpacing: '0.25em',
      color,
      marginTop: 6,
      marginBottom: 2,
      textShadow: `0 0 6px ${color}`,
    }}>
      ◇ {children}
    </div>
  )
}

function AlertCard({ alert, onOpen }: { alert: any; onOpen: () => void }) {
  const color = SEV_COLOR[alert.severity] || '#4fc3f7'
  const name = alert.labels?.alertname || alert.alertname || alert.name || 'Unknown'
  const cluster = alert.labels?.cluster || ''
  return (
    <div
      onClick={onOpen}
      style={{
        background: 'rgba(10, 20, 45, 0.5)',
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(220,240,255,0.95)',
        marginBottom: 4,
      }}>
        {name}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        color: 'rgba(220,240,255,0.55)',
      }}>
        <span>{cluster || 'N/A'}</span>
        <span>{fmtRelative(alert.starts_at || alert.startsAt)}</span>
      </div>
    </div>
  )
}
