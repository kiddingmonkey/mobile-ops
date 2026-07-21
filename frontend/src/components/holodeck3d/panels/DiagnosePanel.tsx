import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { fmtRelative } from '@/utils/format'
import PanelShell from './PanelShell'

/**
 * 诊断面板：集群健康检查 + 节点状态 + 网络诊断
 * 集成原 Diagnose 页面的核心功能到 3D 舰桥面板
 */

export default function DiagnosePanel({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [clusters, setClusters] = useState<any[]>([])
  const [selectedCluster, setSelectedCluster] = useState<any | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [nodes, setNodes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.listClusters().then(cs => {
      setClusters(cs || [])
      if (cs?.length > 0) setSelectedCluster(cs[0])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedCluster) return
    setLoading(true)
    Promise.all([
      api.clusterMetrics(selectedCluster.id).catch(() => null),
      api.get(`/clusters/${selectedCluster.id}/resources/nodes`).catch(() => []),
    ]).then(([m, n]) => {
      setMetrics(m)
      setNodes(n || [])
    }).finally(() => setLoading(false))
  }, [selectedCluster])

  const cpu = metrics?.prometheus?.avg_cpu_usage_percent ?? 0
  const mem = metrics?.prometheus?.avg_mem_usage_percent ?? 0
  const nodeCount = nodes.length
  const readyNodes = nodes.filter((n: any) => n.ready).length
  const notReadyNodes = nodes.filter((n: any) => !n.ready)

  return (
    <PanelShell title="系统诊断" titleEn="DIAGNOSTICS" color="#fbbf24" onClose={onClose}>
      {/* 集群选择 */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid rgba(251,191,36,0.2)',
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {clusters.map(c => {
          const active = selectedCluster?.id === c.id
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCluster(c)}
              style={{
                background: active ? 'rgba(251,191,36,0.15)' : 'transparent',
                border: `1px solid ${active ? '#fbbf24' : 'rgba(251,191,36,0.3)'}`,
                color: active ? '#fbbf24' : 'rgba(220,240,255,0.7)',
                padding: '6px 12px',
                fontSize: 11,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                borderRadius: 2,
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: 'nowrap',
                textShadow: active ? '0 0 6px #fbbf24' : 'none',
              }}
            >
              {c.name || `cluster-${c.id}`}
            </button>
          )
        })}
        <button
          onClick={() => { onClose(); nav('/diagnose') }}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid #4fc3f7',
            color: '#4fc3f7',
            padding: '6px 12px',
            fontSize: 10,
            letterSpacing: '0.2em',
            cursor: 'pointer',
            borderRadius: 2,
            fontFamily: "'JetBrains Mono', monospace",
            whiteSpace: 'nowrap',
          }}
        >
          全屏 →
        </button>
      </div>

      {loading ? (
        <div style={{
          padding: 40,
          textAlign: 'center',
          color: '#fbbf24',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.2em',
          fontSize: 11,
        }}>
          ◇ SCANNING...
        </div>
      ) : !selectedCluster ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          color: 'rgba(220,240,255,0.5)',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.2em',
          fontSize: 12,
        }}>
          ◇ SELECT A CLUSTER<br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>请选择一个集群</span>
        </div>
      ) : (
        <div style={{ padding: 12 }}>
          {/* 健康概览 */}
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.25em',
            color: '#fbbf24',
            marginBottom: 8,
            textShadow: '0 0 6px #fbbf24',
          }}>
            ◇ SYSTEM HEALTH · 系统健康
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
            marginBottom: 16,
          }}>
            <HealthCard label="CPU 使用率" value={`${Math.round(cpu)}%`} color={cpu > 85 ? '#ff3b5c' : cpu > 70 ? '#fbbf24' : '#4ade80'} />
            <HealthCard label="内存使用率" value={`${Math.round(mem)}%`} color={mem > 85 ? '#ff3b5c' : mem > 70 ? '#fbbf24' : '#4ade80'} />
            <HealthCard label="节点总数" value={nodeCount} color="#4fc3f7" />
            <HealthCard label="就绪节点" value={`${readyNodes}/${nodeCount}`} color={readyNodes === nodeCount ? '#4ade80' : '#ff3b5c'} />
          </div>

          {/* 异常节点 */}
          {notReadyNodes.length > 0 && (
            <>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: '0.25em',
                color: '#ff3b5c',
                marginBottom: 8,
                marginTop: 12,
                textShadow: '0 0 6px #ff3b5c',
              }}>
                ⚠ NOT READY NODES · 异常节点 ({notReadyNodes.length})
              </div>
              {notReadyNodes.map((n: any) => (
                <div
                  key={n.name}
                  style={{
                    background: 'rgba(10, 20, 45, 0.5)',
                    border: '1px solid rgba(255,59,92,0.4)',
                    borderLeft: '3px solid #ff3b5c',
                    padding: '8px 10px',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(220,240,255,0.95)', marginBottom: 2 }}>
                    {n.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(220,240,255,0.6)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {n.status || 'NotReady'} · {n.ip || 'N/A'}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* 正常节点列表 */}
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.25em',
            color: '#4ade80',
            marginBottom: 8,
            marginTop: 12,
            textShadow: '0 0 6px #4ade80',
          }}>
            ◇ READY NODES · 就绪节点 ({readyNodes})
          </div>
          {nodes.filter((n: any) => n.ready).slice(0, 10).map((n: any) => (
            <div
              key={n.name}
              style={{
                background: 'rgba(10, 20, 45, 0.4)',
                border: '1px solid rgba(74,222,128,0.2)',
                borderLeft: '2px solid #4ade80',
                padding: '6px 10px',
                marginBottom: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'rgba(220,240,255,0.9)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {n.name}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(220,240,255,0.5)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {n.ip || 'N/A'}
                </div>
              </div>
              <span style={{ fontSize: 9, color: '#4ade80', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>
                READY
              </span>
            </div>
          ))}
          {readyNodes > 10 && (
            <div style={{
              fontSize: 10,
              color: 'rgba(220,240,255,0.5)',
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: 'center',
              marginTop: 8,
              letterSpacing: '0.1em',
            }}>
              还有 {readyNodes - 10} 个节点，点击「全屏」查看全部
            </div>
          )}
        </div>
      )}
    </PanelShell>
  )
}

function HealthCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: `${color}10`,
      border: `1px solid ${color}40`,
      padding: '10px',
      borderRadius: 4,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color,
        textShadow: `0 0 12px ${color}`,
        fontFamily: "'JetBrains Mono', monospace",
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10,
        color: 'rgba(220,240,255,0.7)',
        letterSpacing: '0.1em',
      }}>
        {label}
      </div>
    </div>
  )
}
