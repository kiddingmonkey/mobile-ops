import { useEffect, useState, memo, useRef } from 'react'
import { Tabs, PullToRefresh, Grid, Button, Toast, Dialog, Form, Input, Popup, Selector } from 'antd-mobile'
import { AddOutline, UnorderedListOutline, CloseOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useUI } from '@/store'
import { fmtRelative, fmtPercent, fmtNumber } from '@/utils/format'
import GrafanaPanel from '@/components/GrafanaPanel'
import GrafanaDashboardViewer from '@/components/GrafanaDashboardViewer'
import { CompactHeader, Toolbar } from '@/components/MonitorComponents'

interface PanelConfig {
  id: string
  originalUrl: string
  title: string
  height: number
  useSmartViewer?: boolean  // 是否使用智能查看器
  apiToken?: string          // Grafana API Token
}

function panelsKey(clusterId: number) {
  return `mobile-ops-panels-${clusterId}`
}

// 独立的添加面板弹窗组件（memo 隔离父组件 re-render，避免输入吞字）
const AddPanelPopup = memo(function AddPanelPopup({
  visible,
  onClose,
  onSubmit
}: {
  visible: boolean
  onClose: () => void
  onSubmit: (values: { url: string; title: string; height?: string; useSmartViewer?: boolean; apiToken?: string }) => void
}) {
  const [form] = Form.useForm()
  const [useSmartViewer, setUseSmartViewer] = useState(false)

  // 只在弹窗打开时重置（从关闭变为打开），避免每次 visible 变化都重置
  const prevVisibleRef = useRef(visible)
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      // 从关闭到打开，才重置
      form.resetFields()
      setUseSmartViewer(false)
    }
    prevVisibleRef.current = visible
  }, [visible]) // 移除 form 依赖，避免不必要的重置

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      console.log('表单验证成功，值为:', values)
      onSubmit({ ...values, useSmartViewer })
    } catch (err) {
      console.error('表单验证失败:', err)
      // 显示具体哪个字段验证失败
      if (err && typeof err === 'object' && 'errorFields' in err) {
        const errorFields = (err as any).errorFields
        console.error('验证失败的字段:', errorFields)
      }
    }
  }

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, minHeight: '50vh', maxHeight: '80vh' }}
    >
      <div style={{ padding: '20px 16px' }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>添加 Grafana 面板</div>
        <Form
          form={form}
          layout="vertical"
          footer={
            <div style={{ display: 'flex', gap: 12 }}>
              <Button block onClick={onClose}>取消</Button>
              <Button block color="primary" onClick={handleSubmit}>添加</Button>
            </div>
          }
        >
          <Form.Item
            name="url"
            label="Grafana URL"
            rules={[{ required: true, message: '请输入 URL' }]}
          >
            <Input
              placeholder="https://grafana.example.com/d/..."
              clearable
              onChange={(val) => {
                console.log('URL 输入值变化:', val)
              }}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="面板名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input
              placeholder="例如：集群 CPU 使用率"
              clearable
              onChange={(val) => {
                console.log('面板名称输入值变化:', val)
              }}
            />
          </Form.Item>

          {/* 简化的模式切换 - 紧凑单选按钮 */}
          <Form.Item label="显示模式">
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setUseSmartViewer(false)
                }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: !useSmartViewer ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                  color: !useSmartViewer ? 'white' : 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: !useSmartViewer ? 600 : 400,
                  textAlign: 'center',
                  border: !useSmartViewer ? 'none' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                直接嵌入
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setUseSmartViewer(true)
                }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: useSmartViewer ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                  color: useSmartViewer ? 'white' : 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: useSmartViewer ? 600 : 400,
                  textAlign: 'center',
                  border: useSmartViewer ? 'none' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                智能查看器
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {useSmartViewer ? '大型 Dashboard（20+ 面板）推荐' : '适合单个面板或小型 Dashboard'}
            </div>
          </Form.Item>

          {useSmartViewer && (
            <Form.Item
              name="apiToken"
              label="Grafana API Token（可选）"
              help="用于读取 Dashboard 结构并分组显示"
            >
              <Input placeholder="eyJrIjoixxxx..." clearable />
            </Form.Item>
          )}

          {!useSmartViewer && (
            <Form.Item
              name="height"
              label="面板高度（像素）"
              help="留空自动设置：单面板 300px，整个 dashboard 600px"
            >
              <Input type="number" placeholder="300" />
            </Form.Item>
          )}
        </Form>
      </div>
    </Popup>
  )
})

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

  const submitAddPanel = (values: { url: string; title: string; height?: string; useSmartViewer?: boolean; apiToken?: string }) => {
    const { url, title, height, useSmartViewer, apiToken } = values

    if (!/\/d\/[a-zA-Z0-9_-]+/.test(url)) {
      Toast.show({ content: '不是有效的 Grafana dashboard URL', icon: 'fail' })
      return
    }

    if (!activeClusterId) return

    const isSinglePanel = /[?&](?:viewPanel|panelId)=/.test(url)
    const finalHeight = Number(height) || (isSinglePanel ? 300 : 600)
    const newPanel: PanelConfig = {
      id: crypto.randomUUID(),
      originalUrl: url,
      title,
      height: finalHeight,
      useSmartViewer,
      apiToken
    }
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
      {/* 精简顶栏 */}
      <CompactHeader
        onGrafanaManager={openGrafanaManager}
        onAddPanel={() => setShowAddPanel(true)}
      />

      {/* 内容区 */}
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
            <div>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                style={{ '--content-padding': '0' }}
              >
                {/* Grafana Tab - 全屏优化版 */}
                <Tabs.Tab title="📊 Grafana" key="grafana">
                  {/* 工具栏 */}
                  <Toolbar
                    clusters={clusters}
                    activeClusterId={activeClusterId}
                    onClusterChange={setActive}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    showClusters={clusters.length > 1}
                    showTimeRange={activePanel && !activePanel.useSmartViewer}
                  />

                  {panels.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '80px 20px',
                      color: 'var(--text-tertiary)'
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
                      <div style={{ fontSize: 15, marginBottom: 8 }}>还没有添加 Grafana 面板</div>
                      <div style={{ fontSize: 13 }}>点击右上角按钮添加</div>
                    </div>
                  ) : activePanel ? (
                    <div style={{ position: 'relative', background: 'var(--bg-primary)', minHeight: '70vh' }}>
                      {/* 面板切换悬浮按钮 */}
                      {panels.length > 1 && (
                        <div style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          zIndex: 100,
                          background: 'rgba(0,0,0,0.65)',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 12,
                          color: 'white',
                          display: 'flex',
                          gap: 4,
                          alignItems: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                          {panels.map((p, idx) => (
                            <div
                              key={p.id}
                              onClick={() => setActivePanelId(p.id)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 4,
                                background: p.id === activePanelId ? 'var(--accent-blue)' : 'transparent',
                                fontWeight: p.id === activePanelId ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              {idx + 1}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 删除按钮悬浮 */}
                      <div
                        onClick={() => removePanel(activePanel.id)}
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 100,
                          background: 'rgba(220,38,38,0.9)',
                          color: 'white',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}
                      >
                        <CloseOutline fontSize={14} /> 删除
                      </div>

                      {/* Grafana 面板内容 - 全屏显示 */}
                      {activePanel.useSmartViewer ? (
                        <GrafanaDashboardViewer
                          originalUrl={activePanel.originalUrl}
                          apiToken={activePanel.apiToken}
                        />
                      ) : (
                        <div style={{ paddingTop: 0 }}>
                          <GrafanaPanel
                            url={`${activePanel.originalUrl}&from=${timeRange}&to=now`}
                            title={activePanel.title}
                            height={activePanel.height || 400}
                            enableFullscreen
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </Tabs.Tab>

                {/* K8s 统计 Tab */}
                <Tabs.Tab title="⚙️ K8s 统计" key="k8s">
                  {/* 工具栏 */}
                  <Toolbar
                    clusters={clusters}
                    activeClusterId={activeClusterId}
                    onClusterChange={setActive}
                    showClusters={clusters.length > 1}
                    showTimeRange={false}
                  />

                  <div style={{ padding: '0 12px' }}>
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

                    <Grid columns={2} gap={8}>
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
                  </div>
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

      {/* 添加面板表单弹窗 - 独立组件，隔离父组件 re-render */}
      <AddPanelPopup
        visible={showAddPanel}
        onClose={() => setShowAddPanel(false)}
        onSubmit={submitAddPanel}
      />
    </div>
  )
}
