import { useEffect, useState } from 'react'
import { Selector, PullToRefresh, Grid, Button, Toast, Dialog, Form, Input, Stepper, SwipeAction, List } from 'antd-mobile'
import { AddOutline, DeleteOutline } from 'antd-mobile-icons'
import { api } from '@/api/client'
import { useUI } from '@/store'
import { fmtRelative, fmtPercent, fmtNumber } from '@/utils/format'
import GrafanaPanel from '@/components/GrafanaPanel'

interface PanelConfig {
  id: string
  originalUrl: string   // 用户粘的原始 URL
  title: string
  height: number
}

function panelsKey(clusterId: number) {
  return `mobile-ops-panels-${clusterId}`
}
function loadPanels(clusterId: number): PanelConfig[] {
  try {
    return JSON.parse(localStorage.getItem(panelsKey(clusterId)) || '[]')
  } catch { return [] }
}
function savePanels(clusterId: number, panels: PanelConfig[]) {
  localStorage.setItem(panelsKey(clusterId), JSON.stringify(panels))
}

export default function MonitorPage() {
  const activeClusterId = useUI(s => s.activeClusterId)
  const setActive = useUI(s => s.setActiveCluster)
  const [clusters, setClusters] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any | null>(null)
  const [overview, setOverview] = useState<any | null>(null)
  const [panels, setPanels] = useState<PanelConfig[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [timeRange, setTimeRange] = useState<string>('now-1h')

  useEffect(() => {
    api.listClusters().then(cs => {
      setClusters(cs || [])
      if (!activeClusterId && cs && cs.length > 0) setActive(cs[0].id)
    })
  }, [])

  const load = async () => {
    if (!activeClusterId) return
    try {
      const [m, ov] = await Promise.all([
        api.clusterMetrics(activeClusterId),
        api.clusterOverview(activeClusterId)
      ])
      setMetrics(m)
      setOverview(ov)
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '拉取失败', icon: 'fail' })
    }
  }

  useEffect(() => {
    load()
    if (activeClusterId) setPanels(loadPanels(activeClusterId))
  }, [activeClusterId])

  const addPanel = async () => {
    const url = (window.prompt('粘贴 Grafana URL（完整 dashboard 或单个面板都可以）') || '').trim()
    if (!url) return
    if (!/\/d\/[a-zA-Z0-9_-]+/.test(url)) {
      Toast.show({ content: '不是有效的 Grafana dashboard URL', icon: 'fail' })
      return
    }
    // 从 URL 里猜个默认名字（用 slug）
    const slugMatch = url.match(/\/d\/[a-zA-Z0-9_-]+\/([a-zA-Z0-9_-]+)/)
    const defaultTitle = slugMatch ? decodeURIComponent(slugMatch[1]).replace(/-/g, ' ') : 'Dashboard'
    const title = window.prompt('给这个面板起个名字', defaultTitle) || defaultTitle
    if (!activeClusterId) return
    // 单面板（viewPanel=xx）用小高度，整 dashboard 用大高度
    const isSinglePanel = /[?&](?:viewPanel|panelId)=/.test(url)
    const height = isSinglePanel ? 300 : 600
    const next = [...panels, { id: crypto.randomUUID(), originalUrl: url, title, height }]
    setPanels(next)
    savePanels(activeClusterId, next)
    Toast.show({ content: '已添加', icon: 'success' })
  }

  const removePanel = (id: string) => {
    if (!activeClusterId) return
    const next = panels.filter(p => p.id !== id)
    setPanels(next)
    savePanels(activeClusterId, next)
  }

  const p = metrics?.prometheus
  const k = metrics?.kubectl

  return (
    <div className="page">
      <div className="page-header">监控</div>

      {clusters.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-text">还没有集群<br/>先去「设置」添加</div>
        </div>
      ) : (
        <PullToRefresh onRefresh={load}>
          <div className="page-content">
            <div className="card">
              <div className="card-title">选择集群</div>
              <Selector
                columns={2}
                options={clusters.map(c => ({ label: c.display_name || c.name, value: c.id }))}
                value={activeClusterId ? [activeClusterId] : []}
                onChange={v => v[0] && setActive(v[0] as number)}
              />
            </div>

            {/* 三源交叉指标 */}
            <div className="card">
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>核心指标</span>
                {metrics && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                    {fmtRelative(metrics.fetched_at)}
                  </span>
                )}
              </div>

              <Grid columns={2} gap={12}>
                <Grid.Item>
                  <div className="metric-card">
                    <div className="metric-label">节点总数</div>
                    <div className="metric-value">
                      {fmtNumber(k?.node_count ?? p?.node_count ?? overview?.total_nodes)}
                    </div>
                    <div className="data-source-tag">
                      {k?.node_count !== undefined ? 'kubectl' : (p?.node_count ? 'Prom' : '-')}
                      · {fmtRelative(k?.timestamp || p?.timestamp)}
                    </div>
                  </div>
                </Grid.Item>
                <Grid.Item>
                  <div className="metric-card">
                    <div className="metric-label">Ready</div>
                    <div className="metric-value">
                      {fmtNumber(k?.ready_nodes ?? p?.ready_nodes ?? overview?.ready_nodes)}
                    </div>
                    <div className="data-source-tag">
                      {k?.ready_nodes !== undefined ? 'kubectl' : (p?.ready_nodes ? 'Prom' : '-')}
                    </div>
                  </div>
                </Grid.Item>
                <Grid.Item>
                  <div className="metric-card">
                    <div className="metric-label">Pod 数</div>
                    <div className="metric-value">{fmtNumber(p?.pod_count)}</div>
                    <div className="data-source-tag">来源: Prom</div>
                  </div>
                </Grid.Item>
                <Grid.Item>
                  <div className="metric-card">
                    <div className="metric-label">CPU</div>
                    <div className="metric-value">{fmtPercent(p?.avg_cpu_usage_percent)}</div>
                    <div className="data-source-tag">来源: Prom</div>
                  </div>
                </Grid.Item>
                <Grid.Item span={2}>
                  <div className="metric-card">
                    <div className="metric-label">内存使用率</div>
                    <div className="metric-value">{fmtPercent(p?.avg_mem_usage_percent)}</div>
                    <div className="data-source-tag">来源: Prom</div>
                  </div>
                </Grid.Item>
              </Grid>

              {metrics?.errors && Object.keys(metrics.errors).length > 0 && (
                <div className="warn-banner" style={{ marginTop: 12 }}>
                  {Object.entries(metrics.errors).map(([k, v]) => (
                    <div key={k}>{k}: {String(v)}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Grafana 面板 */}
            <div className="card">
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📈 Grafana 面板</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Selector
                    columns={4}
                    value={[timeRange]}
                    onChange={v => v[0] && setTimeRange(v[0] as string)}
                    options={[
                      { label: '1h', value: 'now-1h' },
                      { label: '6h', value: 'now-6h' },
                      { label: '24h', value: 'now-24h' },
                      { label: '7d', value: 'now-7d' }
                    ]}
                    style={{ '--padding': '2px 8px', fontSize: 12 } as any}
                  />
                </div>
              </div>
              <Button
                block fill="outline" size="small"
                onClick={addPanel}
              ><AddOutline /> 添加面板（粘贴 Grafana URL）</Button>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                从 Grafana 里复制某个面板的分享链接，粘贴进来即可
              </div>
            </div>

            {panels.length > 0 && (
              <>
                {panels.map(pn => (
                  <GrafanaPanel
                    key={pn.id}
                    originalUrl={pn.originalUrl}
                    title={pn.title}
                    from={timeRange}
                    to="now"
                    height={pn.height || 400}
                    onDelete={async () => {
                      const ok = await Dialog.confirm({ content: `删除面板「${pn.title}」？` })
                      if (ok) removePanel(pn.id)
                    }}
                  />
                ))}
              </>
            )}

            {/* 节点池 */}
            {overview?.node_pools && overview.node_pools.length > 0 && (
              <div className="card">
                <div className="card-title">节点池</div>
                {overview.node_pools.map((np: any) => (
                  <div key={np.id} style={{
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{np.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        min={np.min_size} · max={np.max_size}
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      {np.current_size || np.desired_size || '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PullToRefresh>
      )}
    </div>
  )
}
