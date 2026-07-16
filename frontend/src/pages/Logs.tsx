import { useEffect, useState } from 'react'
import { Tabs, PullToRefresh, List, Input, Button, Toast, Empty, Selector, Picker } from 'antd-mobile'
import { SearchOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useUI } from '@/store'
import { fmtTime } from '@/utils/format'

export default function LogsPage() {
  const nav = useNavigate()
  const activeClusterId = useUI(s => s.activeClusterId)
  const setActive = useUI(s => s.setActiveCluster)
  const [clusters, setClusters] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<string>('cloud')

  // 云日志状态
  const [clsLogs, setClsLogs] = useState<any[]>([])
  const [clsLoading, setClsLoading] = useState(false)
  const [clsKeyword, setClsKeyword] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedLogset, setSelectedLogset] = useState('')
  const [regions] = useState([
    { label: '广州', value: 'ap-guangzhou' },
    { label: '上海', value: 'ap-shanghai' },
    { label: '北京', value: 'ap-beijing' },
    { label: '成都', value: 'ap-chengdu' },
    { label: '重庆', value: 'ap-chongqing' },
    { label: '香港', value: 'ap-hongkong' },
    { label: '新加坡', value: 'ap-singapore' }
  ])
  const [logsets, setLogsets] = useState<any[]>([])

  // 容器日志状态
  const [podLogs, setPodLogs] = useState<string>('')
  const [podLoading, setPodLoading] = useState(false)
  const [selectedNamespace, setSelectedNamespace] = useState('')
  const [selectedPod, setSelectedPod] = useState('')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [pods, setPods] = useState<any[]>([])

  useEffect(() => {
    api.listClusters().then(cs => {
      setClusters(cs || [])
      if (!activeClusterId && cs && cs.length > 0) setActive(cs[0].id)
    })
  }, [])

  useEffect(() => {
    if (activeClusterId && activeTab === 'pod') {
      loadNamespaces()
    }
  }, [activeClusterId, activeTab])

  useEffect(() => {
    if (activeTab === 'cloud' && selectedRegion) {
      loadLogsets()
    }
  }, [selectedRegion, activeTab])

  const loadLogsets = async () => {
    if (!selectedRegion) return
    try {
      const logsets = await api.listCLSLogsets(selectedRegion)
      setLogsets(logsets || [])
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '获取日志集失败', icon: 'fail' })
      setLogsets([])
    }
  }

  const loadNamespaces = async () => {
    if (!activeClusterId) return
    try {
      const ns = await api.listNamespaces(activeClusterId)
      setNamespaces(ns || [])
      if (ns && ns.length > 0 && !selectedNamespace) {
        setSelectedNamespace(ns[0])
      }
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '获取 namespace 失败', icon: 'fail' })
    }
  }

  useEffect(() => {
    if (selectedNamespace && activeClusterId) {
      loadPods()
    }
  }, [selectedNamespace, activeClusterId])

  const loadPods = async () => {
    if (!activeClusterId || !selectedNamespace) return
    try {
      const p = await api.listPods(activeClusterId, selectedNamespace)
      setPods(p || [])
      if (p && p.length > 0) {
        setSelectedPod('')
      }
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '获取 Pod 列表失败', icon: 'fail' })
    }
  }

  const loadPodLogs = async () => {
    if (!activeClusterId || !selectedNamespace || !selectedPod) {
      Toast.show({ content: '请先选择 namespace 和 pod', icon: 'fail' })
      return
    }
    setPodLoading(true)
    try {
      const logs = await api.getPodLogs(activeClusterId, selectedNamespace, selectedPod)
      setPodLogs(logs || '(无日志)')
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '获取日志失败', icon: 'fail' })
    } finally {
      setPodLoading(false)
    }
  }

  const searchClsLogs = async () => {
    if (!selectedRegion) {
      Toast.show({ content: '请先选择地域', icon: 'fail' })
      return
    }
    if (!selectedLogset) {
      Toast.show({ content: '请先选择日志集', icon: 'fail' })
      return
    }
    if (!clsKeyword.trim()) {
      Toast.show({ content: '请输入搜索关键词', icon: 'fail' })
      return
    }
    setClsLoading(true)
    try {
      const result = await api.searchCLSLogs({
        region: selectedRegion,
        logset_id: selectedLogset,
        query: clsKeyword,
        limit: 100
      })
      setClsLogs(result.logs || [])
      if (result.logs && result.logs.length > 0) {
        Toast.show({ content: `找到 ${result.logs.length} 条日志`, icon: 'success' })
      } else {
        Toast.show({ content: '未找到匹配的日志', icon: 'fail' })
      }
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '查询失败', icon: 'fail' })
      setClsLogs([])
    } finally {
      setClsLoading(false)
    }
  }

  return (
    <div className="page">
      {/* 顶部工具栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'max(12px, env(safe-area-inset-top)) 16px 12px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div className="page-header" style={{ margin: 0, padding: 0 }}>日志</div>
      </div>

      {clusters.length === 0 && activeTab === 'pod' ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">还没有集群<br/>先去「设置」添加</div>
        </div>
      ) : (
        <>
          {/* 集群切换（仅容器日志 Tab 显示） */}
          {activeTab === 'pod' && (
            <div style={{
              padding: '12px 0',
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-color)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              WebkitOverflowScrolling: 'touch'
            }}>
              <div style={{ display: 'inline-flex', gap: 8, padding: '0 16px', minWidth: '100%' }}>
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
                      fontSize: 14,
                      fontWeight: activeClusterId === c.id ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: activeClusterId === c.id ? 'none' : '1px solid var(--border-color)',
                      flexShrink: 0
                    }}
                  >
                    {c.display_name || c.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 主 Tab 切换 */}
          <div className="page-content" style={{ paddingTop: 0 }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              style={{ '--fixed-active-line-width': '30px' } as any}
            >
              {/* 云日志 Tab */}
              <Tabs.Tab title="☁️ 云日志 (CLS)" key="cloud">
                <div className="card">
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                      选择地域
                    </div>
                    <Selector
                      columns={3}
                      options={regions}
                      value={selectedRegion ? [selectedRegion] : []}
                      onChange={v => {
                        setSelectedRegion(v[0] as string || '')
                        setSelectedLogset('')
                        setClsLogs([])
                      }}
                    />
                  </div>

                  {selectedRegion && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                        选择日志集
                      </div>
                      {logsets.length === 0 ? (
                        <div style={{
                          padding: '12px 16px',
                          background: 'var(--bg-secondary)',
                          borderRadius: 8,
                          fontSize: 13,
                          color: 'var(--text-tertiary)',
                          textAlign: 'center'
                        }}>
                          该地域暂无日志集或功能开发中
                        </div>
                      ) : (
                        <Selector
                          columns={2}
                          options={logsets.map((ls: any) => ({ label: ls.name, value: ls.id }))}
                          value={selectedLogset ? [selectedLogset] : []}
                          onChange={v => {
                            setSelectedLogset(v[0] as string || '')
                            setClsLogs([])
                          }}
                        />
                      )}
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                      搜索关键词
                    </div>
                    <Input
                      placeholder="输入关键词搜索日志"
                      value={clsKeyword}
                      onChange={setClsKeyword}
                      onEnterPress={searchClsLogs}
                      clearable
                    />
                  </div>

                  <Button
                    block
                    color="primary"
                    onClick={searchClsLogs}
                    loading={clsLoading}
                    disabled={!selectedRegion || !selectedLogset}
                  >
                    <SearchOutline /> 搜索日志
                  </Button>

                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.5 }}>
                    腾讯云 CLS 日志查询（通过 AK/SK 或 DataSight）
                  </div>
                </div>

                {clsLogs.length === 0 ? (
                  <Empty
                    style={{ padding: '64px 0' }}
                    imageStyle={{ width: 80 }}
                    description="选择地域、日志集并输入关键词搜索"
                  />
                ) : (
                  <div className="card">
                    <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
                      搜索结果（共 {clsLogs.length} 条）
                    </div>
                    <List mode="card" style={{ '--border-inner': '0px' } as any}>
                      {clsLogs.map((log: any, idx: number) => (
                        <List.Item key={idx}>
                          <div style={{ fontSize: 12, fontFamily: 'Monaco, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {log.content}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{fmtTime(log.timestamp)}</span>
                            {log.source && <span>来源: {log.source}</span>}
                          </div>
                        </List.Item>
                      ))}
                    </List>
                  </div>
                )}
              </Tabs.Tab>

              {/* 容器日志 Tab */}
              <Tabs.Tab title="📦 容器日志 (Pod)" key="pod">
                <div className="card">
                  <List mode="card" style={{
                    '--border-inner': '0px',
                    '--border-top': '0px',
                    '--border-bottom': '0px',
                    '--padding-left': '0px',
                    '--padding-right': '0px'
                  } as any}>
                    <List.Item
                      title={<span style={{ fontSize: 13, fontWeight: 600 }}>Namespace</span>}
                      description={
                        <div style={{ marginTop: 8 }}>
                          {namespaces.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                              正在加载...
                            </div>
                          ) : (
                            <Selector
                              columns={3}
                              options={namespaces.map(ns => ({ label: ns, value: ns }))}
                              value={selectedNamespace ? [selectedNamespace] : []}
                              onChange={v => {
                                setSelectedNamespace(v[0] as string || '')
                                setSelectedPod('')
                                setPodLogs('')
                              }}
                              style={{ '--border-radius': '6px' } as any}
                            />
                          )}
                        </div>
                      }
                    />

                    <List.Item
                      title={<span style={{ fontSize: 13, fontWeight: 600 }}>Pod</span>}
                      description={
                        <div style={{ marginTop: 8 }}>
                          {!selectedNamespace ? (
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                              请先选择 namespace
                            </div>
                          ) : pods.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                              该 namespace 下没有 Pod
                            </div>
                          ) : (
                            <Selector
                              columns={2}
                              options={pods.map(p => ({ label: p.name, value: p.name }))}
                              value={selectedPod ? [selectedPod] : []}
                              onChange={v => {
                                setSelectedPod(v[0] as string || '')
                                setPodLogs('')
                              }}
                              style={{ '--border-radius': '6px' } as any}
                            />
                          )}
                        </div>
                      }
                    />
                  </List>

                  <Button
                    block
                    color="primary"
                    onClick={loadPodLogs}
                    loading={podLoading}
                    disabled={!selectedPod}
                    style={{ marginTop: 16 }}
                  >
                    <SearchOutline /> 查看日志
                  </Button>
                </div>

                {podLogs && (
                  <div className="card">
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>日志内容</span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                        {selectedNamespace}/{selectedPod}
                      </span>
                    </div>
                    <div style={{
                      background: '#1e1e1e',
                      color: '#d4d4d4',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 11,
                      fontFamily: 'Monaco, Menlo, "SF Mono", "Courier New", monospace',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: '60vh',
                      overflowY: 'auto',
                      lineHeight: 1.5
                    }}>
                      {podLogs}
                    </div>
                  </div>
                )}
              </Tabs.Tab>
            </Tabs>
          </div>
        </>
      )}
    </div>
  )
}
