import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { hapticLight } from '@/utils/haptics'
import InBridgeScale from './InBridgeScale'
import { Badge } from './achievements'

interface Props {
  clusterId: number
  clusterName: string
  onClose: () => void
  onStrike?: (x: number, y: number, color?: string) => void
  onBadgesUnlocked?: (b: Badge[]) => void
}

const HEALTH_COLOR = (v: number) => {
  if (v > 90) return '#FF3B5C'
  if (v > 75) return '#FBBF24'
  return '#4ADE80'
}

export default function ClusterInspector({ clusterId, clusterName, onClose, onStrike, onBadgesUnlocked }: Props) {
  const nav = useNavigate()
  const [overview, setOverview] = useState<any | null>(null)
  const [metrics, setMetrics] = useState<any | null>(null)
  const [pools, setPools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    Promise.all([
      api.clusterOverview(clusterId).catch(() => null),
      api.clusterMetrics(clusterId).catch(() => null),
      api.listNodePools(clusterId).catch(() => []),
    ]).then(([ov, m, p]) => {
      setOverview(ov)
      setMetrics(m)
      setPools(p || [])
      setLoading(false)
    })
  }, [clusterId])

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 80)
    return () => clearInterval(t)
  }, [])

  const stats = useMemo(() => {
    const cpu = metrics?.prometheus?.avg_cpu_usage_percent ?? 0
    const mem = metrics?.prometheus?.avg_mem_usage_percent ?? 0
    const nodes = metrics?.kubectl?.node_count ?? metrics?.prometheus?.node_count ?? 0
    const ready = metrics?.kubectl?.ready_nodes ?? metrics?.prometheus?.ready_nodes ?? 0
    const pods = overview?.pod_count ?? metrics?.kubectl?.pod_count ?? 0
    return { cpu, mem, nodes, ready, pods }
  }, [metrics, overview])

  const nodes = useMemo(() => {
    const total = stats.nodes || 0
    return Array.from({ length: Math.min(total, 24) }, (_, i) => ({
      id: i,
      ready: i < stats.ready,
    }))
  }, [stats])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 5, 16, 0.75)',
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
          maxWidth: 900,
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="hd-panel-header">
          <span>◆ CLUSTER INSPECTOR · {clusterName.toUpperCase()}</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
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
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}>
          {/* 左：节点轨道 */}
          <div>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.25em',
              color: 'var(--hd-cyan)',
              marginBottom: 10,
            }}>
              ◇ NODE ORBIT
            </div>
            <div style={{
              aspectRatio: '1 / 1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(5, 10, 25, 0.5)',
              border: '1px solid rgba(120, 200, 255, 0.15)',
              borderRadius: 2,
              position: 'relative',
            }}>
              <svg viewBox="-120 -120 240 240" style={{ width: '100%', height: '100%' }}>
                {/* 3 环轨道 */}
                {[100, 70, 40].map((r, i) => (
                  <circle
                    key={i}
                    cx="0" cy="0" r={r}
                    fill="none"
                    stroke="rgba(79, 195, 247, 0.15)"
                    strokeWidth="0.5"
                    strokeDasharray="2 4"
                  />
                ))}

                {/* 中央集群心脏 */}
                <circle
                  cx="0" cy="0" r="14"
                  fill={HEALTH_COLOR(Math.max(stats.cpu, stats.mem))}
                  opacity="0.2"
                />
                <circle cx="0" cy="0" r="6" fill="var(--hd-cyan)">
                  <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
                </circle>
                <text
                  x="0" y="26"
                  textAnchor="middle"
                  fill="var(--hd-cyan)"
                  fontSize="8"
                  fontFamily="'JetBrains Mono', monospace"
                  letterSpacing="0.15em"
                >
                  {stats.ready}/{stats.nodes} RDY
                </text>

                {/* 节点环绕 */}
                {nodes.map((n, i) => {
                  const orbit = i < 8 ? 100 : i < 16 ? 70 : 40
                  const angleBase = (i / Math.min(8, nodes.length)) * Math.PI * 2
                  const speed = orbit === 100 ? 0.005 : orbit === 70 ? -0.008 : 0.012
                  const angle = angleBase + tick * speed
                  const x = Math.cos(angle) * orbit
                  const y = Math.sin(angle) * orbit
                  const color = n.ready ? '#4ADE80' : '#FF3B5C'
                  return (
                    <g key={n.id}>
                      <circle cx={x} cy={y} r="4" fill={color} opacity="0.2" />
                      <circle cx={x} cy={y} r="2.5" fill={color}>
                        {!n.ready && <animate attributeName="opacity" values="0.3;1;0.3" dur="0.8s" repeatCount="indefinite" />}
                      </circle>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {/* 右：指标 + 节点池 + 操作 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 关键指标 */}
            <div>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                color: 'var(--hd-cyan)',
                marginBottom: 10,
              }}>
                ◇ VITALS
              </div>
              {loading ? (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>SCANNING...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Metric label="CPU" value={`${Math.round(stats.cpu)}%`} color={HEALTH_COLOR(stats.cpu)} />
                  <Metric label="MEM" value={`${Math.round(stats.mem)}%`} color={HEALTH_COLOR(stats.mem)} />
                  <Metric label="NODES" value={`${stats.ready}/${stats.nodes}`} color={stats.ready === stats.nodes ? '#4ADE80' : '#FBBF24'} />
                  <Metric label="PODS" value={String(stats.pods)} color="var(--hd-cyan)" />
                </div>
              )}
            </div>

            {/* 舰桥内扩容 */}
            <div>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                color: 'var(--hd-cyan)',
                marginBottom: 10,
              }}>
                ◇ ORBITAL DEPLOY · 空投增援
              </div>
              <InBridgeScale
                clusterId={clusterId}
                clusterName={clusterName}
                pools={pools}
                onStrike={onStrike}
                onBadgesUnlocked={onBadgesUnlocked}
              />
            </div>

            {/* 快捷动作 */}
            <div>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                color: 'var(--hd-cyan)',
                marginBottom: 10,
              }}>
                ◇ ACTIONS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  className="hd-btn"
                  onClick={() => { hapticLight(); nav(`/cluster-resources?id=${clusterId}`) }}
                  style={{ fontSize: 11, width: '100%' }}
                >
                  ▸ ENTER
                </button>
                <button
                  className="hd-btn"
                  onClick={() => { hapticLight(); nav(`/scale?cluster_id=${clusterId}`) }}
                  style={{ fontSize: 11, width: '100%' }}
                >
                  ▸ SCALE
                </button>
                <button
                  className="hd-btn"
                  onClick={() => { hapticLight(); nav(`/monitor?cluster_id=${clusterId}`) }}
                  style={{ fontSize: 11, width: '100%' }}
                >
                  ▸ MONITOR
                </button>
                <button
                  className="hd-btn"
                  onClick={() => { hapticLight(); nav(`/diagnose?cluster_id=${clusterId}`) }}
                  style={{ fontSize: 11, width: '100%' }}
                >
                  ▸ DIAG
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '8px 10px',
      background: 'rgba(10, 20, 45, 0.5)',
      border: '1px solid rgba(120, 200, 255, 0.15)',
      borderLeft: `3px solid ${color}`,
    }}>
      <div className="hd-text-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.2em' }}>
        {label}
      </div>
      <div className="hd-text-mono" style={{ fontSize: 18, color, fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}
