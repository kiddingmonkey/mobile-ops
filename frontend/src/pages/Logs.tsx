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
  const [selectedContainer, setSelectedContainer] = useState('')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [pods, setPods] = useState<any[]>([])
  const [containers, setContainers] = useState<string[]>([])
  const [logType, setLogType] = useState<'stdout' | 'file'>('stdout')

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

  useEffect(() => {
    if (selectedPod && pods.length > 0) {
      // 获取选中 Pod 的容器列表
      const pod = pods.find(p => p.name === selectedPod)
      if (pod && pod.containers && pod.containers.length > 0) {
        const containerNames = pod.containers.map((c: any) => c.name)
        setContainers(containerNames)
        // 默认选择第一个容器
        if (!selectedContainer || !containerNames.includes(selectedContainer)) {
          setSelectedContainer(containerNames[0])
        }
      } else {
        setContainers([])
        setSelectedContainer('')
      }
    }
  }, [selectedPod, pods])

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
    if (logType === 'stdout' && !selectedContainer) {
      Toast.show({ content: '请先选择容器', icon: 'fail' })
      return
    }
    setPodLoading(true)
    try {
      if (logType === 'stdout') {
        const logs = await api.getPodLogs(activeClusterId, selectedNamespace, selectedPod, selectedContainer)
        setPodLogs(logs || '(无日志)')
      } else {
        // TODO: 文件日志功能
        Toast.show({ content: '容器文件日志功能开发中', icon: 'fail' })
      }
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '获取日志失败', icon: 'fail' })
    } finally {
      setPodLoading(false)
    }
  }

  const searchClsLogs = async (silent = false) => {
    if (!selectedRegion) {
      if (!silent) Toast.show({ content: '请先选择地域', icon: 'fail' })
      return
    }
    if (!selectedLogset) {
      if (!silent) Toast.show({ content: '请先选择日志集', icon: 'fail' })
      return
    }
    setClsLoading(true)
    try {
      // 无关键词时使用 * 查询全部（腾讯云CLS语法）
      const query = clsKeyword.trim() || '*'
      const result = await api.searchCLSLogs({
        region: selectedRegion,
        logset_id: selectedLogset,
        query,
        limit: 100
      })
      setClsLogs(result.logs || [])
      if (!silent) {
        if (result.logs && result.logs.length > 0) {
          Toast.show({ content: `找到 ${result.logs.length} 条日志`, icon: 'success' })
        } else {
          Toast.show({ content: '未找到匹配的日志', icon: 'fail' })
        }
      }
    } catch (e: any) {
      if (!silent) Toast.show({ content: e?.response?.data?.error || '查询失败', icon: 'fail' })
      setClsLogs([])
    } finally {
      setClsLoading(false)
    }
  }

  // 选择日志集后自动加载最近日志
  useEffect(() => {
    if (selectedRegion && selectedLogset && activeTab === 'cloud') {
      searchClsLogs(true)
    }
  }, [selectedLogset])

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
                <div className="card" style={{ padding: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>地域</div>
                      <select
                        value={selectedRegion}
                        onChange={(e) => {
                          setSelectedRegion(e.target.value)
                          setSelectedLogset('')
                          setClsLogs([])
                        }}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          fontSize: 12
                        }}
                      >
                        <option value="">选择地域</option>
                        {regions.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>日志集</div>
                      <select
                        value={selectedLogset}
                        onChange={(e) => {
                          setSelectedLogset(e.target.value)
                          setClsLogs([])
                        }}
                        disabled={!selectedRegion || logsets.length === 0}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          fontSize: 12,
                          opacity: !selectedRegion ? 0.5 : 1
                        }}
                      >
                        <option value="">选择日志集</option>
                        {logsets.map((ls: any) => (
                          <option key={ls.id} value={ls.id}>{ls.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>搜索关键词</div>
                    <Input
                      placeholder="输入关键词搜索日志"
                      value={clsKeyword}
                      onChange={setClsKeyword}
                      onEnterPress={() => searchClsLogs(false)}
                      clearable
                      style={{ '--font-size': '12px' } as any}
                    />
                  </div>

                  <Button
                    block
                    color="primary"
                    size="small"
                    onClick={() => searchClsLogs(false)}
                    loading={clsLoading}
                    disabled={!selectedRegion || !selectedLogset}
                  >
                    {clsKeyword.trim() ? '搜索日志' : '查看最新日志'}
                  </Button>
                </div>

                {clsLogs.length === 0 ? (
                  <Empty
                    style={{ padding: '64px 0' }}
                    imageStyle={{ width: 80 }}
                    description="选择地域、日志集并输入关键词搜索"
                  />
                ) : (
                  <div className="card">
                    <div style={{
                      marginBottom: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: 'var(--text-primary)'
                    }}>
                      <span>
                        日志量: <span style={{ color: 'var(--accent-blue)' }}>{clsLogs.length}</span> 条
                      </span>
                      <Button
                        size="mini"
                        color="primary"
                        fill="outline"
                        onClick={() => {
                          const content = clsLogs.map((log: any) =>
                            `[${fmtTime(log.timestamp)}] ${log.content}`
                          ).join('\n')
                          const blob = new Blob([content], { type: 'text/plain' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `cls-${selectedRegion}-${Date.now()}.log`
                          a.click()
                          URL.revokeObjectURL(url)
                          Toast.show({ content: '日志已下载', icon: 'success' })
                        }}
                      >
                        下载
                      </Button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {clsLogs.map((log: any, idx: number) => (
                        <CLSLogItem
                          key={idx}
                          log={log}
                          onFieldClick={(key, value) => {
                            const query = `${key}:"${value}"`
                            setClsKeyword(query)
                            Toast.show({ content: `已设置查询: ${query}`, icon: 'success' })
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </Tabs.Tab>

              {/* 容器日志 Tab */}
              <Tabs.Tab title="📦 容器日志 (Pod)" key="pod">
                <div className="card" style={{ padding: '12px' }}>
                  {/* 紧凑的选择器 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>Namespace</div>
                      <select
                        value={selectedNamespace}
                        onChange={(e) => {
                          setSelectedNamespace(e.target.value)
                          setSelectedPod('')
                          setSelectedContainer('')
                          setPodLogs('')
                        }}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          fontSize: 12
                        }}
                      >
                        <option value="">选择 namespace</option>
                        {namespaces.map(ns => (
                          <option key={ns} value={ns}>{ns}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>Pod</div>
                      <select
                        value={selectedPod}
                        onChange={(e) => {
                          setSelectedPod(e.target.value)
                          setSelectedContainer('')
                          setPodLogs('')
                        }}
                        disabled={!selectedNamespace || pods.length === 0}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          fontSize: 12,
                          opacity: !selectedNamespace ? 0.5 : 1
                        }}
                      >
                        <option value="">选择 Pod</option>
                        {pods.map(p => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedPod && containers.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: 'var(--text-secondary)' }}>容器</div>
                      {containers.length === 1 ? (
                        <div style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          background: 'var(--accent-blue)',
                          color: 'white',
                          display: 'inline-block'
                        }}>
                          {containers[0]}
                        </div>
                      ) : (
                        <select
                          value={selectedContainer}
                          onChange={(e) => {
                            setSelectedContainer(e.target.value)
                            setPodLogs('')
                          }}
                          style={{
                            width: '100%',
                            padding: '5px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            fontSize: 12
                          }}
                        >
                          <option value="">选择容器</option>
                          {containers.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  <Button
                    block
                    color="primary"
                    size="small"
                    onClick={loadPodLogs}
                    loading={podLoading}
                    disabled={!selectedPod || !selectedContainer}
                  >
                    查看日志
                  </Button>
                </div>

                {podLogs && (
                  <div className="card" style={{ marginTop: 0 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: 'var(--text-secondary)'
                    }}>
                      <span>日志内容</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          size="mini"
                          color="primary"
                          fill="outline"
                          onClick={() => {
                            const blob = new Blob([podLogs], { type: 'text/plain' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${selectedNamespace}-${selectedPod}-${selectedContainer}-${Date.now()}.log`
                            a.click()
                            URL.revokeObjectURL(url)
                            Toast.show({ content: '日志已下载', icon: 'success' })
                          }}
                        >
                          下载
                        </Button>
                        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                          {selectedNamespace}/{selectedPod}/{selectedContainer}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      background: '#1e1e1e',
                      color: '#d4d4d4',
                      padding: 10,
                      borderRadius: 6,
                      fontSize: 10,
                      fontFamily: 'Monaco, Menlo, "SF Mono", "Courier New", monospace',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: '65vh',
                      overflowY: 'auto',
                      lineHeight: 1.4
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

// 单条日志展示组件（可展开、字段可点击）
function CLSLogItem({ log, onFieldClick }: { log: any; onFieldClick: (key: string, value: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  // 尝试将内容解析为JSON对象，如果是键值对则展示为字段列表
  let parsedFields: { key: string; value: string }[] | null = null
  try {
    if (log.content && typeof log.content === 'string') {
      const obj = JSON.parse(log.content)
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        parsedFields = Object.entries(obj).map(([key, value]) => ({
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value)
        }))
      }
    }
  } catch {}

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      borderRadius: 8,
      padding: 10,
      border: '1px solid var(--border-color)'
    }}>
      {/* 时间戳 */}
      <div style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        marginBottom: 6,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>
          {fmtTime(log.timestamp)}
        </span>
        {log.source && (
          <span
            onClick={() => onFieldClick('source', log.source)}
            style={{
              background: 'var(--accent-blue-bg)',
              color: 'var(--accent-blue)',
              padding: '2px 6px',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            {log.source}
          </span>
        )}
      </div>

      {/* 内容 */}
      {parsedFields && parsedFields.length > 0 ? (
        <div>
          {(expanded ? parsedFields : parsedFields.slice(0, 5)).map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, fontSize: 12, alignItems: 'flex-start' }}>
              <span
                onClick={() => onFieldClick(f.key, f.value)}
                style={{
                  color: 'var(--accent-blue)',
                  fontWeight: 600,
                  fontFamily: 'ui-monospace, monospace',
                  cursor: 'pointer',
                  flexShrink: 0,
                  minWidth: 80
                }}
              >
                {f.key}
              </span>
              <span style={{
                color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, monospace',
                wordBreak: 'break-all',
                flex: 1
              }}>
                {f.value}
              </span>
            </div>
          ))}
          {parsedFields.length > 5 && (
            <div
              onClick={() => setExpanded(!expanded)}
              style={{
                fontSize: 11,
                color: 'var(--accent-blue)',
                cursor: 'pointer',
                marginTop: 4,
                textAlign: 'center'
              }}
            >
              {expanded ? '收起' : `展开全部 (${parsedFields.length} 个字段)`}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          fontSize: 12,
          fontFamily: 'ui-monospace, Monaco, Menlo, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: 'var(--text-primary)'
        }}>
          {log.content}
        </div>
      )}
    </div>
  )
}
