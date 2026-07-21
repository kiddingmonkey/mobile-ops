import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { withCache, getCache } from '@/utils/apiCache'
import { hapticLight } from '@/utils/haptics'

interface ClusterNode {
  id: number
  name: string
  metrics?: any
  health: 'ok' | 'warn' | 'critical' | 'unknown'
  ready: number
  total: number
}

function computeHealth(m: any): { health: ClusterNode['health']; ready: number; total: number } {
  const total = m?.kubectl?.node_count ?? m?.prometheus?.node_count ?? 0
  const ready = m?.kubectl?.ready_nodes ?? m?.prometheus?.ready_nodes ?? 0
  if (total === 0) return { health: 'unknown', ready: 0, total: 0 }
  if (ready < total) return { health: 'warn', ready, total }
  const cpu = m?.prometheus?.avg_cpu_usage_percent ?? 0
  const mem = m?.prometheus?.avg_mem_usage_percent ?? 0
  if (cpu > 90 || mem > 90) return { health: 'critical', ready, total }
  if (cpu > 75 || mem > 75) return { health: 'warn', ready, total }
  return { health: 'ok', ready, total }
}

const HEALTH_COLOR: Record<ClusterNode['health'], string> = {
  ok: '#4ADE80',
  warn: '#FBBF24',
  critical: '#FF3B5C',
  unknown: '#5D7A9A',
}

export default function HolodeckStarfield({
  onSelectCluster,
}: {
  onSelectCluster?: (id: number, name?: string) => void
}) {
  const nav = useNavigate()
  const [clusters, setClusters] = useState<any[]>(() => getCache('clusters') || [])
  const [metrics, setMetrics] = useState<Record<number, any>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [tick, setTick] = useState(0)

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
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 100)
    return () => clearInterval(t)
  }, [])

  const nodes: ClusterNode[] = useMemo(() =>
    clusters.map(c => {
      const m = metrics[c.id]
      const h = computeHealth(m)
      return {
        id: c.id,
        name: c.name || c.display_name || `Cluster-${c.id}`,
        metrics: m,
        health: h.health,
        ready: h.ready,
        total: h.total,
      }
    }), [clusters, metrics])

  const handleClick = (n: ClusterNode) => {
    hapticLight()
    setSelected(n.id)
    onSelectCluster?.(n.id, n.name)
  }

  const count = nodes.length
  const radius = 130

  return (
    <div className="hd-panel" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      <div className="hd-panel-header">
        <span>◆ CLUSTER STARMAP</span>
        <span className="hd-text-mono" style={{ fontSize: 10, opacity: 0.7 }}>
          {count} SYS · {nodes.filter(n => n.health === 'ok').length} OK
        </span>
      </div>
      <div className="hd-panel-corner tl" />
      <div className="hd-panel-corner tr" />
      <div className="hd-panel-corner bl" />
      <div className="hd-panel-corner br" />

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <svg viewBox="-180 -180 360 360" style={{ width: '100%', height: '100%', maxWidth: 380 }}>
          {/* 外圈轨道 */}
          {[radius, radius - 40, radius - 80].map((r, i) => (
            <circle
              key={i}
              cx="0" cy="0" r={r}
              fill="none"
              stroke="var(--hd-hologram-line)"
              strokeWidth="0.5"
              strokeDasharray={i === 0 ? '4 4' : '2 6'}
              style={{
                transformOrigin: 'center',
                animation: `${i % 2 === 0 ? 'hd-orbit' : 'hd-orbit-reverse'} ${60 + i * 20}s linear infinite`,
              }}
            />
          ))}

          {/* 十字准星 */}
          <line x1="-160" y1="0" x2="-140" y2="0" stroke="var(--hd-cyan)" strokeWidth="0.8" opacity="0.5" />
          <line x1="160" y1="0" x2="140" y2="0" stroke="var(--hd-cyan)" strokeWidth="0.8" opacity="0.5" />
          <line x1="0" y1="-160" x2="0" y2="-140" stroke="var(--hd-cyan)" strokeWidth="0.8" opacity="0.5" />
          <line x1="0" y1="160" x2="0" y2="140" stroke="var(--hd-cyan)" strokeWidth="0.8" opacity="0.5" />

          {/* 中央恒星 */}
          <circle cx="0" cy="0" r="14" fill="var(--hd-cyan)" opacity="0.15" />
          <circle cx="0" cy="0" r="8" fill="var(--hd-cyan)" opacity="0.4">
            <animate attributeName="r" values="6;10;6" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="3" fill="#E8F4FF">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* 集群节点 */}
          {nodes.map((n, i) => {
            const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2
            const drift = Math.sin(tick / 20 + i) * 3
            const x = Math.cos(angle) * radius + drift
            const y = Math.sin(angle) * radius + drift
            const color = HEALTH_COLOR[n.health]
            const isSelected = selected === n.id
            const size = isSelected ? 10 : 7
            const flash = n.health === 'critical'
            return (
              <g
                key={n.id}
                style={{ cursor: 'pointer' }}
                onClick={() => handleClick(n)}
              >
                {/* 连接线 */}
                <line
                  x1="0" y1="0"
                  x2={x} y2={y}
                  stroke={color}
                  strokeWidth={isSelected ? '0.8' : '0.4'}
                  opacity={isSelected ? 0.6 : 0.2}
                />
                {/* 节点光晕 */}
                <circle
                  cx={x} cy={y}
                  r={size + 8}
                  fill={color}
                  opacity="0.15"
                >
                  {flash && <animate attributeName="opacity" values="0.05;0.4;0.05" dur="1s" repeatCount="indefinite" />}
                </circle>
                {/* 节点主体 */}
                <circle
                  cx={x} cy={y}
                  r={size}
                  fill={color}
                  opacity="0.9"
                >
                  {flash && <animate attributeName="r" values={`${size};${size + 2};${size}`} dur="1s" repeatCount="indefinite" />}
                </circle>
                {/* 名称 */}
                <text
                  x={x}
                  y={y + size + 14}
                  textAnchor="middle"
                  fill="var(--text-secondary)"
                  fontSize="9"
                  fontFamily="'JetBrains Mono', monospace"
                  letterSpacing="0.1em"
                >
                  {n.name.length > 10 ? n.name.slice(0, 10) : n.name}
                </text>
                <text
                  x={x}
                  y={y + size + 24}
                  textAnchor="middle"
                  fill={color}
                  fontSize="8"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {n.ready}/{n.total}
                </text>
              </g>
            )
          })}

          {count === 0 && (
            <text x="0" y="0" textAnchor="middle" fill="var(--text-tertiary)" fontSize="10" letterSpacing="0.2em">
              NO CLUSTERS DETECTED
            </text>
          )}
        </svg>

        {/* 底部选中详情 */}
        {selected !== null && (() => {
          const n = nodes.find(x => x.id === selected)
          if (!n) return null
          return (
            <div style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              padding: '8px 10px',
              background: 'rgba(10, 20, 45, 0.7)',
              border: `1px solid ${HEALTH_COLOR[n.health]}`,
              borderRadius: 2,
              fontSize: 11,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}>
                <span className="hd-text-mono" style={{ color: HEALTH_COLOR[n.health], letterSpacing: '0.15em' }}>
                  ▸ {n.name.toUpperCase()}
                </span>
                <span
                  className="hd-btn"
                  style={{ fontSize: 9, padding: '3px 8px' }}
                  onClick={() => nav('/cluster-resources?id=' + n.id)}
                >
                  ENTER
                </span>
              </div>
              <div className="hd-text-mono" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                NODES {n.ready}/{n.total}
                {n.metrics?.prometheus && (
                  <>
                    {' · CPU '}{Math.round(n.metrics.prometheus.avg_cpu_usage_percent || 0)}%
                    {' · MEM '}{Math.round(n.metrics.prometheus.avg_mem_usage_percent || 0)}%
                  </>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
