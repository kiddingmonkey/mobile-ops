import { useEffect, useState } from 'react'
import { PullToRefresh, Grid, Button, Toast, Skeleton } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { AddOutline, RightOutline } from 'antd-mobile-icons'
import { api } from '@/api/client'
import { useUI, useAuth } from '@/store'
import { fmtRelative, fmtPercent } from '@/utils/format'

interface Cluster {
  id: number
  name: string
  display_name?: string
  provider: string
  status: string
}

interface Overview {
  cluster_id: number
  total_nodes: number
  ready_nodes: number
  not_ready_nodes: number
  fetched_at: string
  nodes_source?: string
}

interface Metrics {
  fetched_at: string
  prometheus?: {
    node_count: number
    ready_nodes: number
    pod_count: number
    avg_cpu_usage_percent: number
    avg_mem_usage_percent: number
  }
  kubectl?: { node_count: number; ready_nodes: number }
}

interface Alert {
  id: number
  severity: string
  alertname: string
  summary?: string
  status: string
  starts_at: string
}

export default function HomePage() {
  const nav = useNavigate()
  const user = useAuth(s => s.user)
  const setActiveCluster = useUI(s => s.setActiveCluster)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [overviews, setOverviews] = useState<Record<number, Overview>>({})
  const [metrics, setMetrics] = useState<Record<number, Metrics>>({})
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const cs = await api.listClusters()
      setClusters(cs || [])
      await Promise.all(
        (cs || []).map(async (c: Cluster) => {
          try {
            const [ov, m] = await Promise.all([
              api.clusterOverview(c.id),
              api.clusterMetrics(c.id)
            ])
            setOverviews(prev => ({ ...prev, [c.id]: ov }))
            setMetrics(prev => ({ ...prev, [c.id]: m }))
          } catch (e) {}
        })
      )
      const al = await api.listAlerts(5).catch(() => [])
      setAlerts(al || [])
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '加载失败', icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const gotoScale = (clusterId: number) => {
    setActiveCluster(clusterId)
    nav('/scale')
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 6) return '深夜辛苦了'
    if (h < 11) return '早上好'
    if (h < 14) return '中午好'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  return (
    <div className="page">
      {/* 顶部问候 + 集群数 */}
      <div style={{
        padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px',
        background: 'var(--bg-primary)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="text-sm" style={{ marginBottom: 4 }}>{greeting()}</div>
            <div className="text-h2">{user?.display_name || user?.username || 'Ops'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-blue)' }} className="text-tabular">
              {clusters.length}
            </div>
            <div className="text-xs">个集群</div>
          </div>
        </div>
      </div>

      <PullToRefresh onRefresh={load}>
        <div className="page-content">
          {loading && clusters.length === 0 ? (
            <>
              <Skeleton animated style={{ '--height': '160px', '--border-radius': '14px' } as any} />
              <Skeleton animated style={{ '--height': '160px', '--border-radius': '14px' } as any} />
            </>
          ) : clusters.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">还没有集群</div>
              <div className="empty-text">点下方按钮，在"设置"里添加你的第一个 K8s 集群</div>
              <Button color="primary" size="large" onClick={() => nav('/settings/clusters/new')}>
                <AddOutline style={{ verticalAlign: '-2px' }} /> 添加集群
              </Button>
            </div>
          ) : (
            <>
              {clusters.map(c => {
                const ov = overviews[c.id]
                const m = metrics[c.id]
                const p = m?.prometheus
                const k = m?.kubectl
                const notReady = ov?.not_ready_nodes || 0
                const status = notReady > 0 ? 'danger' : (ov ? 'success' : 'info')
                const statusText = notReady > 0 ? `${notReady} 节点异常` : (ov ? '健康' : '加载中')
                const totalNodes = k?.node_count ?? p?.node_count ?? ov?.total_nodes ?? 0
                const readyNodes = k?.ready_nodes ?? p?.ready_nodes ?? ov?.ready_nodes ?? 0

                return (
                  <div key={c.id} className="card">
                    {/* 标题 + 状态 */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 16
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {c.display_name || c.name}
                        </div>
                        <div className="text-xs" style={{ marginTop: 2 }}>{c.provider}</div>
                      </div>
                      <span className={`status-badge ${status}`}>{statusText}</span>
                    </div>

                    {/* 三列指标 */}
                    <Grid columns={3} gap={10}>
                      <Grid.Item>
                        <div className="metric-label">节点</div>
                        <div className="metric-value small text-tabular">
                          {readyNodes}<span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>/{totalNodes}</span>
                        </div>
                      </Grid.Item>
                      <Grid.Item>
                        <div className="metric-label">CPU</div>
                        <div className="metric-value small text-tabular">
                          {p?.avg_cpu_usage_percent !== undefined ? fmtPercent(p.avg_cpu_usage_percent) : '—'}
                        </div>
                      </Grid.Item>
                      <Grid.Item>
                        <div className="metric-label">内存</div>
                        <div className="metric-value small text-tabular">
                          {p?.avg_mem_usage_percent !== undefined ? fmtPercent(p.avg_mem_usage_percent) : '—'}
                        </div>
                      </Grid.Item>
                    </Grid>

                    {/* 数据源 tag + 时间戳 */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginTop: 14
                    }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {k && <span className="data-source-tag">kubectl</span>}
                        {p && <span className="data-source-tag">Prom</span>}
                      </div>
                      {m?.fetched_at && (
                        <span className="text-xs">{fmtRelative(m.fetched_at)}</span>
                      )}
                    </div>

                    {/* 底部操作 */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <Button
                        block size="middle" fill="outline"
                        onClick={() => { setActiveCluster(c.id); nav('/monitor') }}
                        style={{ '--border-color': 'var(--border-color)' } as any}
                      >查看监控</Button>
                      <Button
                        block size="middle" color="primary"
                        onClick={() => gotoScale(c.id)}
                      >⚡ 扩缩容</Button>
                    </div>
                  </div>
                )
              })}

              {/* 最近告警 */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">🚨 最近告警</div>
                    <div className="card-subtitle" style={{ marginTop: 2 }}>
                      {alerts.length === 0 ? '当前无告警' : `${alerts.length} 条待处理`}
                    </div>
                  </div>
                  <span
                    style={{ fontSize: 13, color: 'var(--accent-blue)', fontWeight: 500 }}
                    onClick={() => nav('/alerts')}
                  >查看全部 <RightOutline style={{ verticalAlign: '-2px' }} /></span>
                </div>
                {alerts.length === 0 ? (
                  <div style={{
                    padding: '24px 12px', textAlign: 'center',
                    color: 'var(--text-tertiary)', fontSize: 13
                  }}>
                    暂时没有需要关注的告警 ✅
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {alerts.slice(0, 3).map(a => (
                      <div key={a.id} style={{
                        padding: '10px 12px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 10,
                        display: 'flex', alignItems: 'center', gap: 10
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: severityColor(a.severity),
                          flexShrink: 0
                        }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 500,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>{a.alertname}</div>
                          {a.summary && (
                            <div className="text-xs" style={{
                              marginTop: 2,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>{a.summary}</div>
                          )}
                        </div>
                        <div className="text-xs" style={{ flexShrink: 0 }}>{fmtRelative(a.starts_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}

function severityColor(s: string): string {
  switch (s) {
    case 'critical': return 'var(--danger)'
    case 'warning': return 'var(--warning)'
    case 'info': return 'var(--accent-blue)'
    default: return 'var(--text-tertiary)'
  }
}
