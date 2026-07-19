import { useEffect, useState } from 'react'
import { Tabs, PullToRefresh, Grid, Button, Toast, Dialog, Form, Input, Popup, Selector } from 'antd-mobile'
import { AddOutline, UnorderedListOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useUI } from '@/store'
import { fmtRelative, fmtPercent, fmtNumber } from '@/utils/format'
import GrafanaPanel from '@/components/GrafanaPanel'

interface PanelConfig {
  id: string
  originalUrl: string
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
  const nav = useNavigate()
  const activeClusterId = useUI(s => s.activeClusterId)
  const setActive = useUI(s => s.setActiveCluster)
  const [clusters, setClusters] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any | null>(null)
  const [overview, setOverview] = useState<any | null>(null)
  const [panels, setPanels] = useState<PanelConfig[]>([])
  const [activeTab, setActiveTab] = useState<string>('grafana')
  const [activePanelId, setActivePanelId] = useState<string>('')
  const [timeRange, setTimeRange] = useState<string>('now-1h')

  // 弹窗状态
  const [showGrafanaList, setShowGrafanaList] = useState(false)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [grafanaList, setGrafanaList] = useState<any[]>([])

  // 添加面板表单
  const [addPanelForm] = Form.useForm()

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
    if (activeClusterId) {
      const loaded = loadPanels(activeClusterId)
      setPanels(loaded)
      if (loaded.length > 0 && !activePanelId) {
        setActivePanelId(loaded[0].id)
      }
    }
  }, [activeClusterId])

  const loadGrafanaList = async () => {
    const list = await api.listGrafana().catch(() => [])
    setGrafanaList(list)
  }

  const openGrafanaManager = async () => {
    await loadGrafanaList()
    setShowGrafanaList(true)
  }

  const deleteGrafana = async (id: number) => {
    const ok = await Dialog.confirm({ content: '删除这个 Grafana 数据源？' })
    if (!ok) return
    await api.deleteGrafana(id)
    Toast.show({ content: '已删除' })
    loadGrafanaList()
  }

  const openAddPanelForm = () => {
    addPanelForm.resetFields()
    setShowAddPanel(true)
  }

  const submitAddPanel = async () => {
    const values = await addPanelForm.validateFields()
    const { url, title, height } = values

    if (!/\/d\/[a-zA-Z0-9_-]+/.test(url)) {
      Toast.show({ content: '不是有效的 Grafana dashboard URL', icon: 'fail' })
      return
    }

    if (!activeClusterId) return

    const isSinglePanel = /[?&](?:viewPanel|panelId)=/.test(url)
    const finalHeight = height || (isSinglePanel ? 300 : 600)
    const newPanel = { id: crypto.randomUUID(), originalUrl: url, title, height: finalHeight }
    const next = [...panels, newPanel]
    setPanels(next)
    savePanels(activeClusterId, next)
    setActivePanelId(newPanel.id)
    setShowAddPanel(false)
    Toast.show({ content: '已添加', icon: 'success' })
  }

  const removePanel = async (id: string) => {
    const panel = panels.find(p => p.id === id)
    if (!panel) return

    const ok = await Dialog.confirm({ content: `删除面板「${panel.title}」？` })
    if (!ok) return

    if (!activeClusterId) return
    const next = panels.filter(p => p.id !== id)
    setPanels(next)
    savePanels(activeClusterId, next)

    if (activePanelId === id && next.length > 0) {
      setActivePanelId(next[0].id)
    }
    Toast.show({ content: '已删除' })
  }

  const p = metrics?.prometheus
  const k = metrics?.kubectl
  const activePanel = panels.find(pn => pn.id === activePanelId)

  return (
    <div className="page">
      {/* 固定顶栏 */}
      <div style={{ flexShrink: 0 }}>
        {/* 顶部工具栏 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'max(12px, env(safe-area-inset-top)) 16px 12px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>监控</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              fill="outline"
              onClick={openGrafanaManager}
            >
              <UnorderedListOutline /> Grafana
            </Button>
            <Button
              size="small"
              color="primary"
              onClick={openAddPanelForm}
            >
              <AddOutline /> 添加
            </Button>
          </div>
        </div>

        {/* 集群选择 + 时间范围选择 - 统一在顶栏 */}
        <div style={{
          padding: '12px 16px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {/* 集群选择 */}
          {clusters.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>集群</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {clusters.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setActive(c.id)}
                    style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: activeClusterId === c.id ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                      color: activeClusterId === c.id ? 'white' : 'var(--text-primary)',
                      fontSize: 13,
                      fontWeight: activeClusterId === c.id ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: activeClusterId === c.id ? 'none' : '1px solid var(--border-color)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {c.display_name || c.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 时间范围选择 */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>时间范围</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: '1小时', value: 'now-1h' },
                { label: '6小时', value: 'now-6h' },
                { label: '24小时', value: 'now-24h' },
                { label: '7天', value: 'now-7d' }
              ].map(opt => (
                <div
                  key={opt.value}
                  onClick={() => setTimeRange(opt.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: timeRange === opt.value ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                    color: timeRange === opt.value ? 'white' : 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: timeRange === opt.value ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: timeRange === opt.value ? 'none' : '1px solid var(--border-color)',
                    textAlign: 'center'
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 独立滚动内容区 */}
      {clusters.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-text">还没有集群<br/>先去「设置」添加</div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <PullToRefresh onRefresh={load}>
            <div style={{ paddingTop: 0 }}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                style={{ '--fixed-active-line-width': '30px' } as any}
              >
                {/* Grafana Tab */}
                <Tabs.Tab title="📊 Grafana 面板" key="grafana">
                  {panels.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '60px 20px',
                      color: 'var(--text-tertiary)'
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
                      <div style={{ fontSize: 15, marginBottom: 8 }}>还没有添加 Grafana 面板</div>
                      <div style={{ fontSize: 13 }}>点击右上角「添加」按钮开始</div>
                    </div>
                  ) : (
                    <>
                      {/* 面板切换器 */}
                      {panels.length > 1 && (
                        <div className="card">
                          <div style={{
                            display: 'flex',
                            gap: 8,
                            overflowX: 'auto',
                            paddingBottom: 4
                          }}>
                            {panels.map(pn => (
                              <div
                                key={pn.id}
                                onClick={() => setActivePanelId(pn.id)}
                                style={{
                                  flex: '0 0 auto',
                                  padding: '8px 14px',
                                  borderRadius: 8,
                                  background: activePanelId === pn.id ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                                  color: activePanelId === pn.id ? 'white' : 'var(--text-primary)',
                                  fontSize: 13,
                                  fontWeight: activePanelId === pn.id ? 600 : 400,
                                  cursor: 'pointer',
                                  border: activePanelId === pn.id ? 'none' : '1px solid var(--border-color)',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {pn.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 当前激活的面板 */}
                      {activePanel && (
                        <div style={{ position: 'relative' }}>
                          <GrafanaPanel
                            url={`${activePanel.originalUrl}&from=${timeRange}&to=now`}
                            title={activePanel.title}
                            height={activePanel.height || 400}
                            enableFullscreen
                          />
                          <Button
                            size="small"
                            color="danger"
                            fill="outline"
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 50,
                              zIndex: 10,
                              fontSize: 12,
                              padding: '4px 8px'
                            }}
                            onClick={() => removePanel(activePanel.id)}
                          >
                            删除
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </Tabs.Tab>

                {/* K8s 统计 Tab */}
                <Tabs.Tab title="⚙️ K8s 统计" key="k8s">
                  {/* 核心指标 */}
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

                  {/* 节点池 */}
                  {overview?.node_pools && overview.node_pools.length > 0 && (
                    <div className="card">
                      <div className="card-title">节点池</div>
                      {overview.node_pools.map((np: any) => (
                        <div
                          key={np.id}
                          onClick={() => activeClusterId && nav(`/clusters/${activeClusterId}/node-pools/${np.id}`)}
                          style={{
                            padding: '10px 0',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 500 }}>{np.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              min={np.min_size} · max={np.max_size}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>
                              {np.current_size || np.desired_size || '-'}
                            </div>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>›</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Tabs.Tab>
              </Tabs>
            </div>
          </PullToRefresh>
        </div>
      )}

      {/* Grafana 管理弹窗 */}
      <Popup
        visible={showGrafanaList}
        onMaskClick={() => setShowGrafanaList(false)}
        bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, minHeight: '40vh' }}
      >
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Grafana 数据源</div>
          {grafanaList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 13 }}>还没有配置 Grafana 数据源</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>请前往「设置」添加</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {grafanaList.map(g => (
                <div
                  key={g.id}
                  style={{
                    padding: 12,
                    background: 'var(--bg-secondary)',
                    borderRadius: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {g.name}
                      {g.is_default && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 11,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--accent-blue)',
                          color: 'white'
                        }}>默认</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{g.url}</div>
                  </div>
                  <Button
                    size="small"
                    color="danger"
                    fill="none"
                    onClick={() => deleteGrafana(g.id)}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            block
            color="primary"
            style={{ marginTop: 16 }}
            onClick={() => {
              setShowGrafanaList(false)
              nav('/settings/grafana/new')
            }}
          >
            <AddOutline /> 添加新数据源
          </Button>
        </div>
      </Popup>

      {/* 添加面板表单弹窗 */}
      <Popup
        visible={showAddPanel}
        onMaskClick={() => setShowAddPanel(false)}
        bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, minHeight: '50vh' }}
      >
        <div style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>添加 Grafana 面板</div>
          <Form
            form={addPanelForm}
            layout="vertical"
            footer={
              <div style={{ display: 'flex', gap: 12 }}>
                <Button block onClick={() => setShowAddPanel(false)}>取消</Button>
                <Button block color="primary" onClick={submitAddPanel}>添加</Button>
              </div>
            }
          >
            <Form.Item
              name="url"
              label="Grafana URL"
              rules={[{ required: true, message: '请输入 URL' }]}
              help="从 Grafana 复制 dashboard 或面板的分享链接"
            >
              <Input placeholder="https://grafana.example.com/d/..." />
            </Form.Item>
            <Form.Item
              name="title"
              label="面板名称"
              rules={[{ required: true, message: '请输入名称' }]}
            >
              <Input placeholder="例如：集群 CPU 使用率" />
            </Form.Item>
            <Form.Item
              name="height"
              label="面板高度（像素）"
              help="留空自动设置：单面板 300px，整个 dashboard 600px"
            >
              <Input type="number" placeholder="300" />
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  )
}
