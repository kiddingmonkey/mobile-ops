import { useEffect, useState } from 'react'
import { PullToRefresh, Button, Toast, Skeleton, Tag } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { RightOutline } from 'antd-mobile-icons'
import { api, friendlyApiError } from '@/api/client'
import { useUI, useAuth } from '@/store'
import { fmtRelative } from '@/utils/format'
import RemoteStatusBanner from '@/components/RemoteStatusBanner'

interface Cluster { id: number; name: string; display_name?: string; provider: string; status: string }
interface Metrics { fetched_at: string; prometheus?: any; kubectl?: any }

export default function HomePage() {
  const nav = useNavigate()
  const user = useAuth(s => s.user)
  const setActiveCluster = useUI(s => s.setActiveCluster)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [metrics, setMetrics] = useState<Record<number, Metrics>>({})
  const [nodePools, setNodePools] = useState<Record<number, any[]>>({})
  const [alerts, setAlerts] = useState<any[]>([])
  const [ops, setOps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const load = async () => {
    setLoadErr(null)
    try {
      const [cs, al, op] = await Promise.all([
        api.listClusters().catch(e => { setLoadErr(friendlyApiError(e)); return [] }),
        api.listAlerts(10).catch(() => []),
        api.listOperations(5).catch(() => [])
      ])
      setClusters(cs || [])
      setAlerts(al || [])
      setOps(op || [])
      // 每个集群拉 metrics + 节点池
      await Promise.all(
        (cs || []).map(async (c: Cluster) => {
          try {
            const [m, nps] = await Promise.all([
              api.clusterMetrics(c.id).catch(() => null),
              api.listNodePools(c.id).catch(() => [])
            ])
            if (m) setMetrics(prev => ({ ...prev, [c.id]: m }))
            setNodePools(prev => ({ ...prev, [c.id]: nps || [] }))
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

  // 汇总数据
  const totalNodes = clusters.reduce((sum, c) => {
    const m = metrics[c.id]; const p = m?.prometheus; const k = m?.kubectl
    return sum + (k?.node_count ?? p?.node_count ?? 0)
  }, 0)
  const readyNodes = clusters.reduce((sum, c) => {
    const m = metrics[c.id]; const p = m?.prometheus; const k = m?.kubectl
    return sum + (k?.ready_nodes ?? p?.ready_nodes ?? 0)
  }, 0)
  const totalPods = clusters.reduce((sum, c) => {
    const p = metrics[c.id]?.prometheus
    return sum + (p?.pod_count ?? 0)
  }, 0)
  const firingAlerts = alerts.filter(a => a.status === 'firing').length
  const criticalAlerts = alerts.filter(a => a.status === 'firing' && a.severity === 'critical').length

  return (
    <div className="page">
      <RemoteStatusBanner />
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 12px) 16px 8px' }}>
        <div className="text-xs" style={{ marginBottom: 2 }}>{greeting()}</div>
        <div className="text-h2">{user?.display_name || user?.username || 'Ops'}</div>
      </div>

      {/* SRE 状态条 - 秒懂全局健康 */}
      <div style={{
        margin: '0 12px 12px',
        padding: 10,
        background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-secondary) 100%)',
        borderRadius: 8,
        border: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: 8
      }}>
        {/* 集群健康 */}
        <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>集群健康</div>
          <div style={{ fontSize: 16, fontWeight: 600, display: 'flex', justifyContent: 'center', gap: 4 }}>
            <span style={{ color: 'var(--success)' }}>{clusters.filter(c => c.status === 'healthy').length}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <span style={{ color: 'var(--text-secondary)' }}>{clusters.length}</span>
          </div>
        </div>

        {/* 告警数 */}
        <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}
          onClick={() => nav('/alerts')}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>待处理告警</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: criticalAlerts > 0 ? 'var(--danger)' : firingAlerts > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>
            {firingAlerts > 0 ? `${firingAlerts}` : '0'}
            {criticalAlerts > 0 && <span style={{ fontSize: 10, marginLeft: 2 }}>({criticalAlerts} 严重)</span>}
          </div>
        </div>

        {/* 今日任务数 */}
        <div style={{ flex: 1, textAlign: 'center' }} onClick={() => nav('/tasks')}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>今日任务</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)' }}>
            {ops.filter((o: any) => {
              if (!o.created_at) return false
              const today = new Date().toDateString()
              return new Date(o.created_at).toDateString() === today
            }).length}
          </div>
        </div>
      </div>

      <PullToRefresh onRefresh={load}>
        <div style={{ padding: '0 12px 60px' }}>
          {loadErr && (
            <div style={{
              padding: 12, marginBottom: 12,
              borderLeft: '3px solid #F87171',
              background: 'rgba(248, 113, 113, 0.08)',
              borderRadius: 6
            }}>
              <div style={{ fontSize: 12, color: '#FCA5A5', marginBottom: 4 }}>加载失败</div>
              <div style={{ fontSize: 11, opacity: 0.8, wordBreak: 'break-all' }}>{loadErr}</div>
              <Button size="mini" fill="outline" onClick={load} style={{ marginTop: 8 }}>重试</Button>
            </div>
          )}

          {/* 顶部紧凑指标: 6 宫格 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 12
          }}>
            <MiniStat label="集群" value={clusters.length} color="var(--accent-blue)"
              onClick={() => nav('/settings/clusters')} />
            <MiniStat label="节点" value={`${readyNodes}/${totalNodes}`}
              color={readyNodes === totalNodes && totalNodes > 0 ? 'var(--success)' : 'var(--warning)'} />
            <MiniStat label="Pods" value={totalPods} color="var(--text-primary)" />
            <MiniStat label="告警"
              value={firingAlerts}
              color={firingAlerts > 0 ? 'var(--danger)' : 'var(--success)'}
              badge={criticalAlerts > 0 ? `${criticalAlerts} 紧急` : undefined}
              onClick={() => nav('/alerts')} />
            <MiniStat label="操作" value={ops.length} color="var(--text-primary)"
              onClick={() => nav('/operations')} />
            <MiniStat label="监控" value="→" color="var(--accent-blue)"
              onClick={() => nav('/monitor')} />
          </div>

          {/* 快捷操作 (紧凑一行) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            marginBottom: 12
          }}>
            {[
              { icon: '⚡', label: '扩容', onClick: () => nav('/scale') },
              { icon: '📊', label: '监控', onClick: () => nav('/monitor') },
              { icon: '🔔', label: '告警', badge: firingAlerts, onClick: () => nav('/alerts') },
              { icon: '⚙️', label: '设置', onClick: () => nav('/settings') }
            ].map((it, i) => (
              <div key={i} onClick={it.onClick} style={{
                padding: '10px 4px', textAlign: 'center',
                background: 'var(--bg-elevated)', borderRadius: 8,
                cursor: 'pointer', position: 'relative'
              }}>
                <div style={{ fontSize: 20 }}>{it.icon}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {it.label}
                </div>
                {(it as any).badge > 0 && (
                  <div style={{
                    position: 'absolute', top: 4, right: 8,
                    background: 'var(--danger)', color: 'white',
                    fontSize: 10, minWidth: 16, height: 16,
                    borderRadius: 8, display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                  }}>{(it as any).badge}</div>
                )}
              </div>
            ))}
          </div>

          {/* 集群列表 - 紧凑水平卡片 */}
          <SectionTitle title="集群" onMore={() => nav('/settings/clusters')} />
          {loading ? (
            <Skeleton animated style={{ '--height': '80px', '--border-radius': '8px' } as any} />
          ) : clusters.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 24,
              background: 'var(--bg-elevated)', borderRadius: 8,
              color: 'var(--text-tertiary)'
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
              <div style={{ marginBottom: 12, fontSize: 13 }}>还没有集群</div>
              <Button size="small" color="primary"
                onClick={() => nav('/settings/clusters/new')}>添加集群</Button>
            </div>
          ) : clusters.map(c => {
            const m = metrics[c.id]; const p = m?.prometheus; const k = m?.kubectl
            const cpu = p?.avg_cpu_usage_percent
            const mem = p?.avg_mem_usage_percent
            const nodes = k?.node_count ?? p?.node_count ?? 0
            const ready = k?.ready_nodes ?? p?.ready_nodes ?? 0
            const isHealthy = ready === nodes && nodes > 0
            const pools = nodePools[c.id] || []

            return (
              <div key={c.id} style={{
                background: 'var(--bg-elevated)',
                borderRadius: 8,
                padding: 10,
                marginBottom: 8
              }}>
                {/* 集群头部 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                      {c.display_name || c.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {c.provider} · {ready}/{nodes} 节点 · {pools.length} 节点池
                    </div>
                  </div>
                  <Tag color={isHealthy ? 'success' : nodes === 0 ? 'default' : 'danger'}>
                    {isHealthy ? '健康' : nodes === 0 ? '未知' : `${nodes - ready} 异常`}
                  </Tag>
                </div>

                {/* 紧凑指标行 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                  marginBottom: 8
                }}>
                  <InlineMetric label="CPU" value={cpu !== undefined ? `${Math.round(cpu)}%` : '-'}
                    color={cpu > 80 ? 'var(--danger)' : cpu > 60 ? 'var(--warning)' : 'var(--text-primary)'} />
                  <InlineMetric label="内存" value={mem !== undefined ? `${Math.round(mem)}%` : '-'}
                    color={mem > 80 ? 'var(--danger)' : mem > 60 ? 'var(--warning)' : 'var(--text-primary)'} />
                  <InlineMetric label="Pods" value={p?.pod_count ?? '-'} color="var(--text-primary)" />
                </div>

                {/* 节点池 mini 列表 */}
                {pools.length > 0 && (
                  <div style={{
                    background: 'var(--bg-primary)', borderRadius: 6, padding: 8,
                    marginBottom: 8
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                      节点池
                    </div>
                    {pools.slice(0, 3).map((np: any) => (
                      <div
                        key={np.id}
                        onClick={() => nav(`/clusters/${c.id}/node-pools/${np.id}`)}
                        style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '4px 0', fontSize: 12, cursor: 'pointer'
                        }}
                      >
                        <span style={{
                          flex: 1, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>{np.name}</span>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                          {np.current_size ?? np.desired_size ?? '?'}/{np.max_size}
                        </span>
                      </div>
                    ))}
                    {pools.length > 3 && (
                      <div style={{
                        fontSize: 11, color: 'var(--accent-blue)',
                        marginTop: 4, textAlign: 'right'
                      }}>+{pools.length - 3} 更多</div>
                    )}
                  </div>
                )}

                {/* 操作按钮 */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="mini" fill="outline"
                    onClick={() => { setActiveCluster(c.id); nav('/monitor') }}>监控</Button>
                  <Button size="mini" fill="outline"
                    onClick={() => nav(`/clusters/${c.id}/resources`)}>资源</Button>
                  <Button size="mini" color="primary"
                    onClick={() => { setActiveCluster(c.id); nav('/scale') }}
                    style={{ marginLeft: 'auto' }}>⚡ 扩缩容</Button>
                </div>
              </div>
            )
          })}

          {/* 最近告警 */}
          {alerts.length > 0 && (
            <>
              <SectionTitle title="最近告警" onMore={() => nav('/alerts')} />
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 8,
                padding: '4px 12px', marginBottom: 12
              }}>
                {alerts.slice(0, 5).map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 0', borderBottom: '1px solid var(--border-color)'
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: a.severity === 'critical' ? 'var(--danger)' :
                        a.severity === 'warning' ? 'var(--warning)' : 'var(--text-tertiary)'
                    }}/>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                      <div style={{
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', fontWeight: 500
                      }}>{a.alertname}</div>
                      <div style={{
                        fontSize: 10, color: 'var(--text-tertiary)',
                        marginTop: 1
                      }}>
                        {a.severity} · {fmtRelative(a.starts_at)}
                      </div>
                    </div>
                    <Tag color={a.status === 'firing' ? 'danger' : 'success'}
                      style={{ fontSize: 10 }}>
                      {a.status}
                    </Tag>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 最近操作 */}
          {ops.length > 0 && (
            <>
              <SectionTitle title="最近操作" onMore={() => nav('/operations')} />
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 8,
                padding: '4px 12px'
              }}>
                {ops.slice(0, 5).map(o => (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--border-color)',
                    fontSize: 12
                  }}>
                    <span style={{ marginRight: 8, fontSize: 14 }}>
                      {o.action === 'scale_up' ? '⬆️' : o.action === 'scale_down' ? '⬇️' : '⚙️'}
                    </span>
                    <span style={{ flex: 1, fontWeight: 500 }}>
                      {o.action === 'scale_up' ? '扩容' : o.action === 'scale_down' ? '缩容' : o.action}
                      {o.delta ? ` ${o.delta > 0 ? '+' : ''}${o.delta}` : ''}
                    </span>
                    <Tag color={o.status === 'success' ? 'success' :
                      o.status === 'failed' ? 'danger' : 'warning'}
                      style={{ fontSize: 10, marginRight: 6 }}>
                      {o.status}
                    </Tag>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {fmtRelative(o.started_at)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}

// 顶部小指标卡
function MiniStat({ label, value, color, badge, onClick }: {
  label: string
  value: string | number
  color: string
  badge?: string
  onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-elevated)',
      borderRadius: 8,
      padding: '10px 8px',
      textAlign: 'center',
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative'
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      {badge && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          background: 'var(--danger)', color: 'white',
          fontSize: 9, padding: '1px 4px', borderRadius: 8
        }}>{badge}</div>
      )}
    </div>
  )
}

// 集群卡片里的紧凑指标
function InlineMetric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-primary)',
      borderRadius: 6,
      padding: '6px 8px'
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color, marginTop: 1 }}>{value}</div>
    </div>
  )
}

// 分区标题
function SectionTitle({ title, onMore }: { title: string; onMore?: () => void }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 4px 6px'
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        {title}
      </span>
      {onMore && (
        <span onClick={onMore}
          style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}>
          查看 <RightOutline style={{ verticalAlign: '-1px', fontSize: 10 }} />
        </span>
      )}
    </div>
  )
}
