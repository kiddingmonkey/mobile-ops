import { useEffect, useState, useCallback } from 'react'
import { PullToRefresh, Button, Skeleton, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api, friendlyApiError } from '@/api/client'
import { useUI, useAuth } from '@/store'
import { fmtRelative } from '@/utils/format'
import { withCache, getCache } from '@/utils/apiCache'
import { hapticLight } from '@/utils/haptics'
import RemoteStatusBanner from '@/components/RemoteStatusBanner'

export default function HomePage() {
  const nav = useNavigate()
  const user = useAuth(s => s.user)
  const setActiveCluster = useUI(s => s.setActiveCluster)

  const [clusters, setClusters]   = useState<any[]>(() => getCache('clusters') || [])
  const [metrics, setMetrics]     = useState<Record<number, any>>({})
  const [alerts, setAlerts]       = useState<any[]>(() => getCache('alerts_50') || [])
  const [ops, setOps]             = useState<any[]>(() => getCache('ops_10') || [])
  const [loading, setLoading]     = useState(!getCache('clusters'))
  const [err, setErr]             = useState<string | null>(null)
  const [tokenWarning, setTokenWarning] = useState<{ remainingDays: number; needRefresh: boolean } | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [cs, al, op] = await Promise.all([
        withCache('clusters', () => api.listClusters()).catch(e => { setErr(friendlyApiError(e)); return [] }),
        withCache('alerts_50', () => api.listAlerts(50)).catch(() => []),
        withCache('ops_10', () => api.listOperations(10)).catch(() => [])
      ])
      setClusters(cs || [])
      setAlerts(al || [])
      setOps(op || [])
      // 检查拨测 token 有效期
      api.getDialingTokenStatus().then(r => {
        if (r.needRefresh && r.remainingDays !== undefined) {
          setTokenWarning({ remainingDays: r.remainingDays, needRefresh: true })
        }
      }).catch(() => {})
      // 并发拉各集群指标（不阻塞主渲染）
      ;(cs || []).forEach(async (c: any) => {
        try {
          const m = await api.clusterMetrics(c.id).catch(() => null)
          if (m) setMetrics(prev => ({ ...prev, [c.id]: m }))
        } catch {}
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // === 汇总数据 ===
  // 读取告警分类策略（首页只展示"我的"告警）
  const alertFilterConfig = (() => {
    try {
      const saved = localStorage.getItem('alert_filter_config')
      return saved ? JSON.parse(saved) : { clusterValues: ['jyyun'], systemNameValues: [] }
    } catch { return { clusterValues: ['jyyun'], systemNameValues: [] } }
  })()
  const isMyAlert = (a: any) => {
    const cluster = a.labels?.cluster || ''
    const sysName = a.labels?.system_name || a.labels?.exported_system_name || ''
    const clusterMatch = alertFilterConfig.clusterValues.length === 0 || alertFilterConfig.clusterValues.includes(cluster)
    if (!clusterMatch) return false
    if (alertFilterConfig.systemNameValues.length === 0) return true
    return alertFilterConfig.systemNameValues.includes(sysName)
  }

  const firingAlerts   = alerts.filter(a => a.status === 'firing' && isMyAlert(a))
  const criticals      = firingAlerts.filter(a => a.severity === 'critical')
  const warnings       = firingAlerts.filter(a => a.severity === 'warning')
  const runningOps     = ops.filter(o => ['executing','polling','pending','prechecking'].includes(o.status))
  const failedOps      = ops.filter(o => o.status === 'failed')

  // 集群健康分布
  const clusterHealth = clusters.map(c => {
    const m = metrics[c.id]
    const nodes  = m?.kubectl?.node_count  ?? m?.prometheus?.node_count  ?? 0
    const ready  = m?.kubectl?.ready_nodes ?? m?.prometheus?.ready_nodes ?? 0
    if (nodes === 0) return 'unknown'
    if (ready < nodes) return 'warn'
    const cpu = m?.prometheus?.avg_cpu_usage_percent ?? 0
    const mem = m?.prometheus?.avg_mem_usage_percent ?? 0
    if (cpu > 85 || mem > 85) return 'warn'
    return 'ok'
  })
  const greenCount   = clusterHealth.filter(s => s === 'ok').length
  const warnCount    = clusterHealth.filter(s => s === 'warn').length
  const unknownCount = clusterHealth.filter(s => s === 'unknown').length

  // 系统整体风险等级
  const riskLevel = criticals.length > 0 ? 'critical'
    : (warnings.length > 0 || warnCount > 0 || failedOps.length > 0) ? 'warning'
    : 'ok'

  const riskColor = riskLevel === 'critical' ? 'var(--danger)'
    : riskLevel === 'warning' ? 'var(--warning)'
    : 'var(--success)'

  const riskLabel = riskLevel === 'critical' ? '有严重告警，需立即处理'
    : riskLevel === 'warning' ? '有警告，请关注'
    : '系统运行正常'

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
      <RemoteStatusBanner />

      {/* 顶部 header - flex-shrink: 0 不参与滚动 */}
      <div style={{ flexShrink: 0, padding: 'calc(env(safe-area-inset-top) + 10px) 16px 8px', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{greeting()}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 1 }}>
          {user?.display_name || user?.username || 'SRE'}
        </div>
      </div>

      {/* 内容区 - flex: 1 + overflow: auto */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <PullToRefresh onRefresh={load}>
          <div style={{ padding: '0 12px 16px' }}>

          {/* ① 系统健康状态条 */}
          <div
            onClick={() => { hapticLight(); nav('/alerts') }}
            style={{
              background: `linear-gradient(135deg, ${riskColor}18 0%, ${riskColor}08 100%)`,
              border: `1.5px solid ${riskColor}40`,
              borderLeft: `4px solid ${riskColor}`,
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 24 }}>
              {riskLevel === 'critical' ? '🔴' : riskLevel === 'warning' ? '🟡' : '🟢'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: riskColor }}>{riskLabel}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', gap: 8 }}>
                {clusters.length > 0 && <span>集群 {greenCount}✓ {warnCount > 0 ? `${warnCount}⚠️` : ''}</span>}
                {firingAlerts.length > 0 && <span>{criticals.length > 0 ? `${criticals.length} 严重` : ''} {warnings.length > 0 ? `${warnings.length} 警告` : ''}</span>}
                {runningOps.length > 0 && <span>{runningOps.length} 任务执行中</span>}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>›</div>
          </div>

          {/* ② Token 过期告警 */}
          {tokenWarning && tokenWarning.needRefresh && (
            <div
              onClick={() => { hapticLight(); nav('/settings/dialing') }}
              style={{
                background: 'linear-gradient(135deg, rgba(255, 80, 80, 0.12) 0%, rgba(255, 80, 80, 0.05) 100%)',
                border: '1.5px solid rgba(255, 80, 80, 0.3)',
                borderLeft: '4px solid var(--danger)',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: 20 }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>
                  拨测平台 Token 即将过期
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  剩余 {tokenWarning.remainingDays} 天，点击查看刷新指引
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>›</div>
            </div>
          )}

          {err && !loading && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12 }}>
              <span style={{ color: 'var(--danger)' }}>{err}</span>
              <Button size="mini" fill="none" style={{ marginLeft: 8 }} onClick={load}>重试</Button>
            </div>
          )}

          {/* ② 紧急告警（Critical 优先展示） */}
          {criticals.length > 0 && (
            <Section title={`🔴 严重告警 (${criticals.length})`} onMore={() => nav('/alerts')}>
              {criticals.slice(0, 3).map((a, i) => (
                <AlertRow key={i} alert={a} onClick={() => nav('/alerts')} />
              ))}
            </Section>
          )}

          {/* ③ 快速操作 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 }}>
            {[
              { icon: '⚡', label: '扩容', path: '/scale', color: 'var(--accent-blue)' },
              { icon: '🔍', label: '诊断', path: '/diagnose', color: 'var(--success)' },
              { icon: '☸️', label: '资源', path: clusters[0] ? `/clusters/${clusters[0].id}/resources` : '/settings/clusters', color: 'var(--warning)' },
              { icon: '📡', label: '拨测', path: '/dialing', color: 'var(--accent-blue)' },
              { icon: '🔒', label: '安全组', path: '/settings/security-groups', color: 'var(--text-secondary)' }
            ].map((it, i) => (
              <div
                key={i}
                onClick={() => { hapticLight(); nav(it.path) }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '12px 4px',
                  background: 'var(--bg-elevated)', borderRadius: 10,
                  cursor: 'pointer', gap: 4
                }}
              >
                <div style={{ fontSize: 22 }}>{it.icon}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>{it.label}</div>
              </div>
            ))}
          </div>

          {/* ④ 集群健康总览（紧凑横向卡片） */}
          {loading ? (
            <Skeleton animated style={{ '--height': '60px', '--border-radius': '8px' } as any} />
          ) : clusters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>☸️</div>
              还没有集群
              <br />
              <Button size="mini" color="primary" style={{ marginTop: 8 }} onClick={() => nav('/settings/clusters/new')}>添加集群</Button>
            </div>
          ) : (
            <Section title="集群" onMore={() => nav('/settings/clusters')}>
              {clusters.map(c => {
                const m = metrics[c.id]
                const p = m?.prometheus
                const k = m?.kubectl
                const nodes = k?.node_count ?? p?.node_count ?? 0
                const ready = k?.ready_nodes ?? p?.ready_nodes ?? 0
                const cpu = p?.avg_cpu_usage_percent
                const mem = p?.avg_mem_usage_percent
                const healthy = nodes > 0 && ready === nodes
                return (
                  <div
                    key={c.id}
                    onClick={() => { hapticLight(); setActiveCluster(c.id); nav(`/clusters/${c.id}/resources`) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 0',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      minHeight: 36
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: healthy ? 'var(--success)' : nodes === 0 ? 'var(--text-tertiary)' : 'var(--warning)' }} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                        {c.display_name || c.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 8, flexShrink: 0 }}>
                        <span>{ready}/{nodes}</span>
                        {cpu !== undefined && <span>C {Math.round(cpu)}%</span>}
                        {mem !== undefined && <span>M {Math.round(mem)}%</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </Section>
          )}

          {/* ⑤ 进行中任务 */}
          {runningOps.length > 0 && (
            <Section title={`⏳ 进行中 (${runningOps.length})`} onMore={() => nav('/tasks')}>
              {runningOps.slice(0, 3).map((o, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{o.action === 'scale_up' ? '⬆️ 扩容' : o.action === 'scale_down' ? '⬇️ 缩容' : '⚙️ ' + o.action}</span>
                  <span style={{ color: 'var(--warning)', fontSize: 11 }}>运行中</span>
                </div>
              ))}
            </Section>
          )}

          {/* ⑥ 最近操作 */}
          {ops.filter(o => o.status !== 'executing').length > 0 && (
            <Section title="最近操作" onMore={() => nav('/tasks')}>
              {ops.filter(o => !['executing','polling','pending','prechecking'].includes(o.status)).slice(0, 5).map((o, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {o.action === 'scale_up' ? '⬆️' : o.action === 'scale_down' ? '⬇️' : '⚙️'} {o.action === 'scale_up' ? '扩容' : o.action === 'scale_down' ? '缩容' : o.action}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmtRelative(o.started_at)}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: o.status === 'success' ? 'var(--success)' : o.status === 'failed' ? 'var(--danger)' : 'var(--text-tertiary)'
                    }}>{o.status === 'success' ? '✓' : o.status === 'failed' ? '✗' : o.status}</span>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* ⑦ Warning 告警（折叠展示） */}
          {warnings.length > 0 && criticals.length === 0 && (
            <Section title={`⚠️ 警告告警 (${warnings.length})`} onMore={() => nav('/alerts')}>
              {warnings.slice(0, 3).map((a, i) => (
                <AlertRow key={i} alert={a} onClick={() => nav('/alerts')} />
              ))}
            </Section>
          )}

        </div>
      </PullToRefresh>
      </div>
    </div>
  )
}

// --- 子组件 ---

function Section({ title, children, onMore }: { title: string; children: React.ReactNode; onMore?: () => void }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
        {onMore && (
          <span onClick={onMore} style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}>更多 ›</span>
        )}
      </div>
      {children}
    </div>
  )
}

function AlertRow({ alert: a, onClick }: { alert: any; onClick: () => void }) {
  const color = a.severity === 'critical' ? 'var(--danger)' : a.severity === 'warning' ? 'var(--warning)' : 'var(--accent-blue)'
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 0', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: color, boxShadow: `0 0 4px ${color}` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.alertname}</div>
        {a.summary && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.summary}</div>}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmtRelative(a.starts_at)}</span>
    </div>
  )
}
