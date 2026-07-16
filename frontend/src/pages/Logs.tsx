import { useEffect, useState } from 'react'
import { Tabs, PullToRefresh, List, Input, Button, Toast, Empty, Selector } from 'antd-mobile'
import { SearchOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useUI } from '@/store'
import { fmtTime, fmtRelative } from '@/utils/format'

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
    if (!clsKeyword.trim()) {
      Toast.show({ content: '请输入搜索关键词', icon: 'fail' })
      return
    }
    setClsLoading(true)
    try {
      // TODO: 调用后端 CLS 日志查询接口
      Toast.show({ content: 'CLS 日志查询功能开发中', icon: 'fail' })
      setClsLogs([])
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '查询失败', icon: 'fail' })
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

      {clusters.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">还没有集群<br/>先去「设置」添加</div>
        </div>
      ) : (
        <>
          {/* 集群切换 */}
          <div style={{
            padding: '12px 0',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ display: 'inline-flex', gap: 8, padding: '0 16px' }}>
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
                    border: activeClusterId === c.id ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  {c.display_name || c.name}
                </div>
              ))}
            </div>
          </div>

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
                  <div style={{ marginBottom: 12 }}>
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
                  >
                    <SearchOutline /> 搜索日志
                  </Button>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                    腾讯云 CLS 日志查询（通过 AK/SK 或 DataSight）
                  </div>
                </div>

                {clsLogs.length === 0 ? (
                  <Empty
                    style={{ padding: '64px 0' }}
                    description="输入关键词搜索云日志"
                  />
                ) : (
                  <div className="card">
                    <List>
                      {clsLogs.map((log: any, idx: number) => (
                        <List.Item key={idx}>
                          <div style={{ fontSize: 13 }}>{log.content}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {fmtTime(log.timestamp)}
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
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Namespace</div>
                    <Selector
                      columns={3}
                      options={namespaces.map(ns => ({ label: ns, value: ns }))}
                      value={selectedNamespace ? [selectedNamespace] : []}
                      onChange={v => v[0] && setSelectedNamespace(v[0] as string)}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Pod</div>
                    {pods.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {selectedNamespace ? '该 namespace 下没有 Pod' : '请先选择 namespace'}
                      </div>
                    ) : (
                      <Selector
                        columns={2}
                        options={pods.map(p => ({ label: p.name, value: p.name }))}
                        value={selectedPod ? [selectedPod] : []}
                        onChange={v => v[0] && setSelectedPod(v[0] as string)}
                      />
                    )}
                  </div>

                  <Button
                    block
                    color="primary"
                    onClick={loadPodLogs}
                    loading={podLoading}
                    disabled={!selectedPod}
                  >
                    <SearchOutline /> 查看日志
                  </Button>
                </div>

                {podLogs && (
                  <div className="card">
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                      日志内容 ({selectedNamespace}/{selectedPod})
                    </div>
                    <div style={{
                      background: 'var(--bg-secondary)',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 11,
                      fontFamily: 'Monaco, Menlo, monospace',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: '60vh',
                      overflowY: 'auto'
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
