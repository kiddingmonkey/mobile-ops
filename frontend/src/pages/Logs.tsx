import { useEffect, useState } from 'react'
import { Tabs, PullToRefresh, List, Input, Button, Toast, Empty, Selector, Picker, Dialog } from 'antd-mobile'
import { SearchOutline, InformationCircleOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useUI } from '@/store'
import { fmtTime } from '@/utils/format'
import { shareLog, downloadLog, makeLogFilename } from '@/utils/logShare'

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
  const [clsKeywordInput, setClsKeywordInput] = useState('') // 临时输入值，防止吞字
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedLogset, setSelectedLogset] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<any>(null) // 当前选中的topic完整信息
  const [timeRange, setTimeRange] = useState('15m')
  const [showTimeRangePicker, setShowTimeRangePicker] = useState(false)
  const [logLevel, setLogLevel] = useState<'error' | 'warn' | 'info' | 'all'>('error') // 默认过滤 error
  const LOG_LEVELS = [
    { label: 'ERROR', value: 'error', color: '#ef4444' },
    { label: 'WARN', value: 'warn', color: '#f59e0b' },
    { label: 'INFO', value: 'info', color: '#3b82f6' },
    { label: 'ALL', value: 'all', color: '#6b7280' }
  ] as const
  const TIME_RANGES = [
    { label: '最近5分钟', value: '5m' },
    { label: '最近15分钟', value: '15m' },
    { label: '最近30分钟', value: '30m' },
    { label: '最近1小时', value: '1h' },
    { label: '最近3小时', value: '3h' },
    { label: '最近6小时', value: '6h' },
    { label: '最近12小时', value: '12h' },
    { label: '最近24小时', value: '24h' }
  ]
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
  const [podTail, setPodTail] = useState<number>(500)
  const [podPrevious, setPodPrevious] = useState<boolean>(false)
  const [podFontSize, setPodFontSize] = useState<number>(10)
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
      // 自动选择第一个日志集
      if (logsets && logsets.length > 0 && !selectedLogset) {
        setSelectedLogset(logsets[0].logset_id)
      }
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
        const result = await api.getPodLogs(activeClusterId, selectedNamespace, selectedPod, selectedContainer, podTail, podPrevious)
        const logText = typeof result === 'string' ? result : (result?.logs || result?.data || JSON.stringify(result))
        setPodLogs(logText || (podPrevious ? '没有上次崩溃的日志' : '(无日志)'))
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
    // 从输入框同步到查询关键词
    const finalKeyword = clsKeywordInput.trim()
    setClsKeyword(finalKeyword)

    setClsLoading(true)
    try {
      // 拼接日志级别过滤（用 CLS 全文搜索匹配 error/warn/info 关键词）
      let levelFilter = ''
      if (logLevel === 'error') levelFilter = 'error OR ERROR OR Error'
      else if (logLevel === 'warn') levelFilter = 'warn OR WARN OR Warning'
      else if (logLevel === 'info') levelFilter = 'info OR INFO'
      // all 不加过滤

      // 组合查询
      let query = '*'
      if (finalKeyword && levelFilter) {
        query = `(${finalKeyword}) AND (${levelFilter})`
      } else if (finalKeyword) {
        query = finalKeyword
      } else if (levelFilter) {
        query = levelFilter
      }

      // 计算时间范围
      const now = Date.now()
      const rangeMap: Record<string, number> = {
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '3h': 3 * 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '12h': 12 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000
      }
      const duration = rangeMap[timeRange] || 15 * 60 * 1000
      const startTime = new Date(now - duration).toISOString()
      const endTime = new Date(now).toISOString()

      const result = await api.searchCLSLogs({
        region: selectedRegion,
        logset_id: selectedLogset,
        query,
        limit: 100,
        start_time: startTime,
        end_time: endTime
      })
      setClsLogs(result.logs || [])
      // 保存 topic 信息用于索引配置展示
      if (result.topic_id && !selectedTopic) {
        loadTopicDetail(result.topic_id)
      }
      if (!silent) {
        if (result.logs && result.logs.length > 0) {
          Toast.show({ content: `找到 ${result.logs.length} 条日志`, icon: 'success' })
        } else {
          Toast.show({
            content: `${timeRange}内未找到日志\n尝试: 1) 扩大时间范围 2) 检查日志集是否有数据`,
            icon: 'fail',
            duration: 3000
          })
        }
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || e?.message || '查询失败'
      if (!silent) Toast.show({ content: '查询失败: ' + errMsg, icon: 'fail', duration: 3000 })
      setClsLogs([])
    } finally {
      setClsLoading(false)
    }
  }

  const loadTopicDetail = async (topicId: string) => {
    // 简化版：暂不调后端API，用静态提示
    setSelectedTopic({ id: topicId, name: '当前日志主题' })
  }

  const showIndexHelp = () => {
    Dialog.alert({
      title: '📘 CLS 索引 & 查询说明',
      content: (
        <div style={{ textAlign: 'left', fontSize: 12, lineHeight: 1.8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent-blue)' }}>查询语法示例：</div>
          <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 4, fontFamily: 'monospace', fontSize: 11, marginBottom: 12 }}>
            <div>• * 或留空 — 查询所有日志</div>
            <div>• error — 包含 error 的日志</div>
            <div>• level:error — 字段精确匹配</div>
            <div>• status:500 AND method:POST</div>
            <div>• "exact phrase" — 精确短语</div>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent-blue)' }}>索引配置：</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
            <div>✓ 全文索引：已启用（需在 CLS 控制台确认）</div>
            <div>• 字段索引：根据日志结构自动解析</div>
            <div>• 若查不到数据，检查：</div>
            <div style={{ marginLeft: 12 }}>1. 日志主题是否开启索引</div>
            <div style={{ marginLeft: 12 }}>2. 时间范围是否正确</div>
            <div style={{ marginLeft: 12 }}>3. 关键词是否存在</div>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent-blue)' }}>快捷操作：</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            <div>• 点击时间范围快速切换</div>
            <div>• 留空关键词查看最新日志</div>
            <div>• 下拉刷新重新查询</div>
          </div>

          <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
            💡 更多查询语法请参考腾讯云 CLS 文档
          </div>
        </div>
      ),
      confirmText: '知道了'
    })
  }

  // 选择日志集后自动加载最近日志
  useEffect(() => {
    if (selectedRegion && selectedLogset && activeTab === 'cloud') {
      searchClsLogs(true)
    }
  }, [selectedLogset])

  // 日志级别变化时自动重新查询
  useEffect(() => {
    if (selectedRegion && selectedLogset && activeTab === 'cloud') {
      searchClsLogs(true)
    }
  }, [logLevel])

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
                {/* 紧凑控制条：四个下拉 + 搜索框在两行 */}
                <div style={{
                  padding: '6px 8px',
                  background: 'var(--bg-elevated)',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  {/* 第一行：地域 + 日志集 + 时间 + 级别 */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <select
                      value={selectedRegion}
                      onChange={(e) => { setSelectedRegion(e.target.value); setSelectedLogset(''); setClsLogs([]) }}
                      style={{ flex: 1, minWidth: 0, padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-primary)' }}
                    >
                      <option value="">地域</option>
                      {regions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <select
                      value={selectedLogset}
                      onChange={(e) => { setSelectedLogset(e.target.value); setClsLogs([]) }}
                      disabled={!selectedRegion || logsets.length === 0}
                      style={{ flex: 1.4, minWidth: 0, padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-primary)', opacity: !selectedRegion ? 0.5 : 1 }}
                    >
                      <option value="">日志集</option>
                      {logsets.map((ls: any) => <option key={ls.id} value={ls.id}>{ls.name}</option>)}
                    </select>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      style={{ flex: 1, minWidth: 0, padding: '4px 4px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-primary)' }}
                    >
                      {TIME_RANGES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <select
                      value={logLevel}
                      onChange={(e) => setLogLevel(e.target.value as any)}
                      style={{
                        width: 74, flexShrink: 0, padding: '4px 4px', borderRadius: 4,
                        border: `1px solid ${logLevel === 'error' ? 'var(--danger)' : logLevel === 'warn' ? 'var(--warning)' : 'var(--border-color)'}`,
                        background: logLevel === 'error' ? 'var(--danger-bg)' : logLevel === 'warn' ? 'var(--warning-bg)' : 'var(--bg-secondary)',
                        color: logLevel === 'error' ? 'var(--danger)' : logLevel === 'warn' ? 'var(--warning)' : 'var(--text-primary)',
                        fontSize: 11, fontWeight: logLevel !== 'all' ? 600 : 400
                      }}
                    >
                      {LOG_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>

                  {/* 第二行：搜索框 + 搜索按钮 */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Input
                        placeholder="搜索关键词 (支持 CLS 语法)"
                        value={clsKeywordInput}
                        onChange={(val) => setClsKeywordInput(val)}
                        onEnterPress={() => searchClsLogs(false)}
                        clearable
                        style={{ '--font-size': '11px' } as any}
                      />
                    </div>
                    <InformationCircleOutline
                      fontSize={16}
                      onClick={showIndexHelp}
                      style={{ color: 'var(--accent-blue)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <Button
                      color="primary"
                      size="mini"
                      onClick={() => searchClsLogs(false)}
                      loading={clsLoading}
                      disabled={!selectedRegion || !selectedLogset}
                      style={{ flexShrink: 0, fontSize: 11 }}
                    >
                      {clsKeywordInput.trim() ? '搜索' : '查询'}
                    </Button>
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button
                          size="mini"
                          fill="outline"
                          onClick={async () => {
                            const content = clsLogs.map((log: any) =>
                              `[${fmtTime(log.timestamp)}] ${log.content}`
                            ).join('\n')
                            const filename = makeLogFilename(`cls_${selectedRegion}`)
                            const r = await downloadLog(content, filename)
                            Toast.show({ content: r ? '已下载' : '下载失败', icon: r ? 'success' : 'fail' })
                          }}
                        >
                          📥 下载
                        </Button>
                        <Button
                          size="mini"
                          color="primary"
                          fill="outline"
                          onClick={async () => {
                            const content = clsLogs.map((log: any) =>
                              `[${fmtTime(log.timestamp)}] ${log.content}`
                            ).join('\n')
                            const filename = makeLogFilename(`cls_${selectedRegion}`)
                            try {
                              await shareLog({ content, filename, title: `CLS日志 - ${selectedRegion}` })
                            } catch (e: any) {
                              Toast.show({ content: '分享失败', icon: 'fail' })
                            }
                          }}
                        >
                          📤 分享
                        </Button>
                      </div>
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
                {/* 紧凑控制条 */}
                <div style={{
                  padding: '6px 8px',
                  background: 'var(--bg-elevated)',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  {/* 第一行：namespace + pod + 容器 */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <select
                      value={selectedNamespace}
                      onChange={(e) => { setSelectedNamespace(e.target.value); setSelectedPod(''); setSelectedContainer(''); setPodLogs('') }}
                      style={{ flex: 1, minWidth: 0, padding: '4px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-primary)' }}
                    >
                      <option value="">namespace</option>
                      {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                    </select>
                    <select
                      value={selectedPod}
                      onChange={(e) => { setSelectedPod(e.target.value); setSelectedContainer(''); setPodLogs('') }}
                      disabled={!selectedNamespace || pods.length === 0}
                      style={{ flex: 1.5, minWidth: 0, padding: '4px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-primary)', opacity: !selectedNamespace ? 0.5 : 1 }}
                    >
                      <option value="">Pod</option>
                      {pods.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                    {containers.length > 0 && (
                      <select
                        value={selectedContainer}
                        onChange={(e) => { setSelectedContainer(e.target.value); setPodLogs('') }}
                        style={{ flex: 1, minWidth: 0, padding: '4px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-primary)' }}
                      >
                        {containers.length > 1 && <option value="">容器</option>}
                        {containers.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </div>

                  {/* 第二行：行数 + 上次崩溃 + 查看按钮 */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select
                      value={podTail}
                      onChange={(e) => setPodTail(Number(e.target.value))}
                      style={{ width: 60, flexShrink: 0, padding: '4px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-primary)' }}
                    >
                      {[100, 200, 500, 1000, 2000].map(n => <option key={n} value={n}>{n}行</option>)}
                    </select>
                    <span
                      onClick={() => setPodPrevious(!podPrevious)}
                      style={{
                        padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', flexShrink: 0,
                        background: podPrevious ? 'var(--warning)' : 'var(--bg-secondary)',
                        color: podPrevious ? '#fff' : 'var(--text-primary)',
                        border: '1px solid ' + (podPrevious ? 'var(--warning)' : 'var(--border-color)')
                      }}
                    >
                      {podPrevious ? '✓ 崩溃' : '上次崩溃'}
                    </span>
                    <div style={{ flex: 1 }} />
                    <Button
                      color="primary" size="mini"
                      onClick={loadPodLogs}
                      loading={podLoading}
                      disabled={!selectedPod || !selectedContainer}
                      style={{ flexShrink: 0, fontSize: 11 }}
                    >
                      查看日志
                    </Button>
                  </div>
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
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Button
                          size="mini"
                          fill="outline"
                          onClick={async () => {
                            const filename = makeLogFilename(`${selectedPod}_${selectedContainer}`)
                            const r = await downloadLog(podLogs, filename)
                            Toast.show({ content: r ? '已下载' : '下载失败', icon: r ? 'success' : 'fail' })
                          }}
                        >
                          📥 下载
                        </Button>
                        <Button
                          size="mini"
                          color="primary"
                          fill="outline"
                          onClick={async () => {
                            const filename = makeLogFilename(`${selectedPod}_${selectedContainer}`)
                            try {
                              await shareLog({ content: podLogs, filename, title: `Pod日志 - ${selectedPod}` })
                            } catch {
                              Toast.show({ content: '分享失败', icon: 'fail' })
                            }
                          }}
                        >
                          📤 分享
                        </Button>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {selectedNamespace}/{selectedPod}/{selectedContainer}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span
                          onClick={() => setPodFontSize(Math.max(7, podFontSize - 1))}
                          style={{
                            padding: '2px 6px', fontSize: 11, cursor: 'pointer',
                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            borderRadius: 3, border: '1px solid var(--border-color)'
                          }}
                        >A-</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 18, textAlign: 'center' }}>{podFontSize}</span>
                        <span
                          onClick={() => setPodFontSize(Math.min(20, podFontSize + 1))}
                          style={{
                            padding: '2px 6px', fontSize: 11, cursor: 'pointer',
                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            borderRadius: 3, border: '1px solid var(--border-color)'
                          }}
                        >A+</span>
                      </div>
                    </div>
                    <div style={{
                      background: '#1e1e1e',
                      color: '#d4d4d4',
                      padding: 10,
                      borderRadius: 6,
                      fontSize: podFontSize,
                      fontFamily: 'Monaco, Menlo, "SF Mono", "Courier New", monospace',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: '65vh',
                      overflowY: 'auto',
                      lineHeight: 1.4
                    }}>
                      {podLogs ? (
                        podLogs.split('\n').map((line, i) => {
                          const isError = /ERROR|FATAL|CRITICAL|Exception|exception|error|fail|failed/i.test(line)
                          return (
                            <div
                              key={i}
                              style={{
                                background: isError ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
                                color: isError ? '#FCA5A5' : '#d4d4d4',
                                padding: isError ? '2px 4px' : '0',
                                margin: isError ? '1px 0' : '0',
                                borderLeft: isError ? '3px solid #DC2626' : 'none'
                              }}
                            >
                              {line || ' '}
                            </div>
                          )
                        })
                      ) : (
                        '选择 Pod 和容器后点击加载日志'
                      )}
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
                flex: 1,
                background: /ERROR|FATAL|CRITICAL|Exception|exception|error|fail|failed/i.test(f.value) ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
                borderLeft: /ERROR|FATAL|CRITICAL|Exception|exception|error|fail|failed/i.test(f.value) ? '3px solid #DC2626' : 'none',
                padding: /ERROR|FATAL|CRITICAL|Exception|exception|error|fail|failed/i.test(f.value) ? '2px 4px' : '0'
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
          color: 'var(--text-primary)',
          background: /ERROR|FATAL|CRITICAL|Exception|exception|error|fail|failed/i.test(log.content) ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
          borderLeft: /ERROR|FATAL|CRITICAL|Exception|exception|error|fail|failed/i.test(log.content) ? '3px solid #DC2626' : 'none',
          padding: /ERROR|FATAL|CRITICAL|Exception|exception|error|fail|failed/i.test(log.content) ? '6px' : '0'
        }}>
          {log.content}
        </div>
      )}
    </div>
  )
}
