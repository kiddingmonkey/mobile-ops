import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { withCache, getCache } from '@/utils/apiCache'
import { hapticLight } from '@/utils/haptics'

/**
 * 星系总览 overlay
 * 点击中央恒星弹出，宏观视图（所有集群 + 告警/任务汇总 + 快捷跳转）
 */

interface Props {
  onClose: () => void
  onEnterCluster: (id: number, name: string) => void
}

const HEALTH_LABEL: Record<string, { label: string; color: string }> = {
  ok: { label: 'NOMINAL', color: '#4ADE80' },
  warn: { label: 'CAUTION', color: '#FBBF24' },
  critical: { label: 'CRITICAL', color: '#FF3B5C' },
  unknown: { label: 'UNKNOWN', color: '#5D7A9A' },
}

function computeHealth(m: any) {
  const total = m?.kubectl?.node_count ?? m?.prometheus?.node_count ?? 0
  const ready = m?.kubectl?.ready_nodes ?? m?.prometheus?.ready_nodes ?? 0
  if (total === 0) return { health: 'unknown' as const, ready, total, cpu: 0, mem: 0 }
  const cpu = m?.prometheus?.avg_cpu_usage_percent ?? 0
  const mem = m?.prometheus?.avg_mem_usage_percent ?? 0
  if (ready < total) return { health: 'warn' as const, ready, total, cpu, mem }
  if (cpu > 90 || mem > 90) return { health: 'critical' as const, ready, total, cpu, mem }
  if (cpu > 75 || mem > 75) return { health: 'warn' as const, ready, total, cpu, mem }
  return { health: 'ok' as const, ready, total, cpu, mem }
}

export default function GalaxyOverview({ onClose, onEnterCluster }: Props) {
  const nav = useNavigate()
  const [clusters, setClusters] = useState<any[]>(() => getCache('clusters') || [])
  const [metrics, setMetrics] = useState<Record<number, any>>({})
  const [alerts, setAlerts] = useState<any[]>(() => getCache('alerts_50') || [])
  const [ops, setOps] = useState<any[]>(() => getCache('ops_10') || [])

  useEffect(() => {
    withCache('clusters', () => api.listClusters()).then(cs => {
      setClusters(cs || [])
      ;(cs || []).forEach(async (c: any) => {
        try {
          const m = await api.clusterMetrics(c.id).catch(() => null)
          if (m) setMetrics(prev => ({ ...prev, [c.id]: m }))
        } catch {}
      })
    }).catch(() => {})
    withCache('alerts_50', () => api.listAlerts(50)).then(a => setAlerts(a || [])).catch(() => {})
    withCache('ops_10', () => api.listOperations(10)).then(o => setOps(o || [])).catch(() => {})
  }, [])

  const rows = useMemo(() =>
    clusters.map(c => {
      const m = metrics[c.id]
      const h = computeHealth(m)
      return {
        id: c.id,
        name: c.name || `cluster-${c.id}`,
        displayName: c.display_name && c.display_name !== c.name ? c.display_name : undefined,
        region: c.region,
        ...h,
      }
    }), [clusters, metrics])

  const summary = useMemo(() => {
    const firing = alerts.filter(a => a.status === 'firing')
    const c = firing.filter(a => a.severity === 'critical').length
    const w = firing.filter(a => a.severity === 'warning').length
    const running = ops.filter(o => ['executing', 'polling', 'pending', 'prechecking'].includes(o.status)).length
    const okClusters = rows.filter(r => r.health === 'ok').length
    return { critical: c, warning: w, running, okClusters, totalClusters: rows.length }
  }, [alerts, ops, rows])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 5, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'hd-fade-in 0.3s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hd-panel"
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="hd-panel-header">
          <span>◆ GALAXY OVERVIEW · 星系总览</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div className="hd-panel-corner tl" />
        <div className="hd-panel-corner tr" />
        <div className="hd-panel-corner bl" />
        <div className="hd-panel-corner br" />

        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 20,
        }}>
          {/* 顶部汇总 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10,
            marginBottom: 20,
          }}>
            <SumCard label="CLUSTERS" value={`${summary.okClusters}/${summary.totalClusters}`}
              color={summary.okClusters === summary.totalClusters ? '#4ADE80' : '#FBBF24'} />
            <SumCard label="CRIT" value={String(summary.critical)}
              color={summary.critical > 0 ? '#FF3B5C' : '#5D7A9A'} />
            <SumCard label="WARN" value={String(summary.warning)}
              color={summary.warning > 0 ? '#FBBF24' : '#5D7A9A'} />
            <SumCard label="OPS RUN" value={String(summary.running)} color="#4FC3F7" />
            <SumCard label="TIME" value={new Date().toTimeString().slice(0, 5)} color="#4FC3F7" />
          </div>

          {/* 集群列表 */}
          <div style={{
            fontSize: 10,
            letterSpacing: '0.25em',
            color: 'var(--hd-cyan)',
            marginBottom: 10,
          }}>
            ◇ CLUSTER FLEET · 舰队列表
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {rows.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12 }}>
                NO CLUSTERS
              </div>
            )}
            {rows.map(r => {
              const hInfo = HEALTH_LABEL[r.health]
              return (
                <div
                  key={r.id}
                  onClick={() => { hapticLight(); onEnterCluster(r.id, r.name); onClose() }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 90px',
                    gap: 12,
                    padding: '10px 12px',
                    background: 'rgba(10, 20, 45, 0.55)',
                    border: '1px solid rgba(120, 200, 255, 0.15)',
                    borderLeft: `3px solid ${hInfo.color}`,
                    borderRadius: 2,
                    cursor: 'pointer',
                    alignItems: 'center',
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{
                      color: 'var(--hd-cyan)',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      fontSize: 12,
                    }}>
                      ▸ {r.name}
                    </div>
                    {r.displayName && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>
                        {r.displayName}
                      </div>
                    )}
                  </div>
                  <div className="hd-text-mono" style={{
                    fontSize: 10,
                    color: hInfo.color,
                    letterSpacing: '0.15em',
                    fontWeight: 600,
                  }}>
                    {hInfo.label}
                  </div>
                  <div className="hd-text-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    NODES {r.ready}/{r.total}
                  </div>
                  <div className="hd-text-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {Math.round(r.cpu)}% · {Math.round(r.mem)}%
                  </div>
                  <div style={{
                    color: 'var(--hd-cyan)',
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    textAlign: 'right',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    ENTER ▸
                  </div>
                </div>
              )
            })}
          </div>

          {/* 快捷跳转 */}
          <div style={{
            fontSize: 10,
            letterSpacing: '0.25em',
            color: 'var(--hd-cyan)',
            marginBottom: 10,
          }}>
            ◇ QUICK ACTIONS
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}>
            <button className="hd-btn" style={{ fontSize: 11 }} onClick={() => { onClose(); nav('/alerts') }}>
              ▸ ALERTS
            </button>
            <button className="hd-btn" style={{ fontSize: 11 }} onClick={() => { onClose(); nav('/tasks') }}>
              ▸ TASKS
            </button>
            <button className="hd-btn" style={{ fontSize: 11 }} onClick={() => { onClose(); nav('/diagnose') }}>
              ▸ DIAG
            </button>
            <button className="hd-btn" style={{ fontSize: 11 }} onClick={() => { onClose(); nav('/monitor') }}>
              ▸ MONITOR
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SumCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(10, 20, 45, 0.55)',
      border: '1px solid rgba(120, 200, 255, 0.15)',
      borderTop: `2px solid ${color}`,
      borderRadius: 2,
    }}>
      <div className="hd-text-mono" style={{
        fontSize: 9,
        color: 'var(--text-tertiary)',
        letterSpacing: '0.2em',
      }}>
        {label}
      </div>
      <div className="hd-text-mono" style={{
        fontSize: 20,
        color,
        fontWeight: 700,
        letterSpacing: '0.05em',
        marginTop: 4,
      }}>
        {value}
      </div>
    </div>
  )
}
