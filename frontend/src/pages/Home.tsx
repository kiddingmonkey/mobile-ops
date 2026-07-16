import { useEffect, useState } from 'react'
import { PullToRefresh, Grid, Button, Skeleton } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { RightOutline } from 'antd-mobile-icons'
import { api, friendlyApiError } from '@/api/client'
import { useUI, useAuth } from '@/store'
import { fmtRelative, fmtPercent } from '@/utils/format'
import ProgressRing from '@/components/ProgressRing'
import StatCard from '@/components/StatCard'
import RemoteStatusBanner from '@/components/RemoteStatusBanner'

interface Cluster { id: number; name: string; display_name?: string; provider: string; status: string }
interface Metrics { fetched_at: string; prometheus?: any; kubectl?: any }

export default function HomePage() {
  const nav = useNavigate()
  const user = useAuth(s => s.user)
  const setActiveCluster = useUI(s => s.setActiveCluster)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [metrics, setMetrics] = useState<Record<number, Metrics>>({})
  const [alerts, setAlerts] = useState<any[]>([])
  const [ops, setOps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const load = async () => {
    setLoadErr(null)
    try {
      // 每个接口独立 catch，一个挂了不影响其他，页面永远能渲染
      const [cs, al, op] = await Promise.all([
        api.listClusters().catch(e => { setLoadErr(friendlyApiError(e)); return [] }),
        api.listAlerts(5).catch(() => []),
        api.listOperations(5).catch(() => [])
      ])
      setClusters(cs || [])
      setAlerts(al || [])
      setOps(op || [])
      await Promise.all(
        (cs || []).map(async (c: Cluster) => {
          try {
            const m = await api.clusterMetrics(c.id)
            setMetrics(prev => ({ ...prev, [c.id]: m }))
          } catch {}
        })
      )
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 6) return '深夜辛苦了'
    if (h < 11) return '早上好'
    if (h < 14) return '中午好'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  const totalNodes = clusters.reduce((sum, c) => {
    const m = metrics[c.id]; const p = m?.prometheus; const k = m?.kubectl
    return sum + (k?.node_count ?? p?.node_count ?? 0)
  }, 0)

  const firingAlerts = alerts.filter(a => a.status === 'firing').length

  return (
    <div className="page">
      <RemoteStatusBanner />
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 20px 12px' }}>
        <div className="text-sm" style={{ marginBottom: 2 }}>{greeting()}</div>
        <div className="text-h2">{user?.display_name || user?.username || 'Ops'}</div>
      </div>

      <PullToRefresh onRefresh={load}>
        <div className="page-content">
          {loadErr && (
            <div className="card" style={{
              borderLeft: '3px solid #F87171',
              background: 'rgba(248, 113, 113, 0.08)'
            }}>
              <div style={{ fontSize: 13, color: '#FCA5A5', marginBottom: 6 }}>加载数据失败</div>
              <div style={{ fontSize: 12, opacity: 0.8, wordBreak: 'break-all' }}>{loadErr}</div>
              <Button size="mini" fill="outline" onClick={load} style={{ marginTop: 10 }}>重试</Button>
            </div>
          )}
          {/* 系统概览 */}
          <StatCard items={[
            { label: '集群', value: clusters.length, color: 'var(--accent-blue)' },
            { label: '节点', value: totalNodes },
            { label: '告警', value: firingAlerts, color: firingAlerts > 0 ? 'var(--danger)' : 'var(--success)' },
            { label: '操作', value: ops.length }
          ]} />

          {/* 快捷操作 */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">快捷操作</span>
            </div>
            <Grid columns={4} gap={10}>
              {[
                { icon: '⚡', label: '扩容', onClick: () => nav('/scale') },
                { icon: '📊', label: '监控', onClick: () => nav('/monitor') },
                { icon: '🔔', label: '告警', onClick: () => nav('/alerts') },
                { icon: '⚙️', label: '设置', onClick: () => nav('/settings') }
              ].map((it, i) => (
                <Grid.Item key={i}>
                  <div onClick={it.onClick} style={{
                    textAlign: 'center', padding: '12px 0', cursor: 'pointer',
                    borderRadius: 10, background: 'var(--bg-elevated)'
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{it.icon}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{it.label}</div>
                  </div>
                </Grid.Item>
              ))}
            </Grid>
          </div>

          {/* 集群状态 */}
          {loading ? (
            <Skeleton animated style={{ '--height': '140px', '--border-radius': '14px' } as any} />
          ) : clusters.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">还没有集群</div>
              <div className="empty-text">去设置里添加你的 K8s 集群</div>
              <Button color="primary" onClick={() => nav('/settings/clusters/new')}>添加集群</Button>
            </div>
          ) : clusters.map(c => {
            const m = metrics[c.id]; const p = m?.prometheus; const k = m?.kubectl
            const cpu = p?.avg_cpu_usage_percent
            const mem = p?.avg_mem_usage_percent
            const nodes = k?.node_count ?? p?.node_count ?? 0
            const ready = k?.ready_nodes ?? p?.ready_nodes ?? 0

            return (
              <div key={c.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{c.display_name || c.name}</div>
                    <div className="text-xs" style={{ marginTop: 2 }}>{c.provider} · 节点 {ready}/{nodes}</div>
                  </div>
                  <span className={`status-badge ${ready === nodes && nodes > 0 ? 'success' : nodes === 0 ? 'info' : 'danger'}`}>
                    {ready === nodes && nodes > 0 ? '健康' : nodes === 0 ? '未知' : `${nodes - ready} 异常`}
                  </span>
                </div>

                {/* CPU + 内存环形图 */}
                {(cpu !== undefined || mem !== undefined) && (
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', margin: '8px 0 14px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <ProgressRing value={cpu ?? 0} size={70} sublabel="CPU" />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <ProgressRing value={mem ?? 0} size={70} sublabel="内存" />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <ProgressRing value={nodes > 0 ? (ready / nodes) * 100 : 0} size={70} sublabel="节点" color="var(--accent-blue)" />
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button block size="small" fill="outline" onClick={() => { setActiveCluster(c.id); nav('/monitor') }}
                    style={{ '--border-color': 'var(--border-color)' } as any}>监控</Button>
                  <Button block size="small" fill="outline" onClick={() => nav(`/clusters/${c.id}/resources`)}
                    style={{ '--border-color': 'var(--border-color)' } as any}>资源</Button>
                  <Button block size="small" color="primary" onClick={() => { setActiveCluster(c.id); nav('/scale') }}>⚡ 扩缩容</Button>
                </div>
              </div>
            )
          })}

          {/* 最近告警 */}
          {alerts.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">最近告警</span>
                <span style={{ fontSize: 12, color: 'var(--accent-blue)' }} onClick={() => nav('/alerts')}>
                  查看全部 <RightOutline style={{ verticalAlign: '-1px' }} />
                </span>
              </div>
              {alerts.slice(0, 3).map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid var(--border-color)'
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: a.severity === 'critical' ? 'var(--danger)' : 'var(--warning)'
                  }}/>
                  <div style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.alertname}
                  </div>
                  <span className="text-xs">{fmtRelative(a.starts_at)}</span>
                </div>
              ))}
            </div>
          )}

          {/* 最近操作 */}
          {ops.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">最近操作</span>
                <span style={{ fontSize: 12, color: 'var(--accent-blue)' }} onClick={() => nav('/operations')}>
                  查看全部 <RightOutline style={{ verticalAlign: '-1px' }} />
                </span>
              </div>
              {ops.slice(0, 3).map(o => (
                <div key={o.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{o.action === 'scale_up' ? '⬆️' : o.action === 'scale_down' ? '⬇️' : '⚙️'}</span>
                    <span style={{ fontSize: 13 }}>
                      {o.action === 'scale_up' ? '扩容' : o.action === 'scale_down' ? '缩容' : o.action}
                      {o.delta ? ` ${o.delta > 0 ? '+' : ''}${o.delta}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`status-badge ${o.status === 'success' ? 'success' : o.status === 'failed' ? 'danger' : 'warning'}`} style={{ fontSize: 10 }}>
                      {o.status}
                    </span>
                    <span className="text-xs">{fmtRelative(o.started_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}
