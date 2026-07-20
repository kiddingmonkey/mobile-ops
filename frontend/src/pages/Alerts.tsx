import { useEffect, useState } from 'react'
import { PullToRefresh, Tabs, Collapse, Button, Dialog, Toast, Switch, ActionSheet } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api, friendlyApiError } from '@/api/client'
import { fmtRelative, fmtTime } from '@/utils/format'
import StatCard from '@/components/StatCard'
import { sendUrgentAlert, getTTSEnabled, setTTSEnabled, getFloatingAlertEnabled, setFloatingAlertEnabled, requestFloatingPermission, testTTS } from '@/utils/alertNotifier'
import { analyzeAlert } from '@/utils/alertAnalyzer'
import { shareAlertCard } from '@/utils/shareCard'
import { extractPromQLFromURL, formatPromResult } from '@/utils/promql'
import { Capacitor } from '@capacitor/core'

export default function AlertsPage() {
  const nav = useNavigate()
  const [alerts, setAlerts] = useState<any[]>([])
  const [tab, setTab] = useState('mine')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterNamespace, setFilterNamespace] = useState<string>('all')
  const [filterLabel, setFilterLabel] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50 // 增大单页数量让第一页尽可能展示所有
  const [ttsOn, setTtsOn] = useState(getTTSEnabled())
  const [floatingOn, setFloatingOn] = useState(getFloatingAlertEnabled())
  const [activeSilences, setActiveSilences] = useState<any[]>([])
  // 不关注的告警名称列表（持久化到 localStorage）
  const [ignoredAlerts, setIgnoredAlerts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('ignored_alertnames')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  // 本地状态：已确认和已静默的告警 ID（后端未实现时用 localStorage）
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('acknowledged_alerts')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [silenced, setSilenced] = useState<Map<string, number>>(() => {
    try {
      const saved = localStorage.getItem('silenced_alerts')
      if (!saved) return new Map()
      const obj = JSON.parse(saved)
      // 过滤掉已过期的静默
      const now = Date.now()
      const filtered = Object.entries(obj).filter(([_, time]) => (time as number) > now)
      return new Map(filtered as [string, number][])
    } catch {
      return new Map()
    }
  })

  const load = async () => {
    const a = await api.listAlerts(200).catch(() => [])
    setAlerts(a || [])
    // 加载活跃的 silences（使用默认 Alertmanager ID=1）
    const silences = await api.listSilences(1).catch(() => [])
    setActiveSilences(silences.filter((s: any) => s.status?.state === 'active'))
  }
  useEffect(() => { load() }, [])

  // 保存状态到 localStorage
  useEffect(() => {
    localStorage.setItem('acknowledged_alerts', JSON.stringify([...acknowledged]))
  }, [acknowledged])

  useEffect(() => {
    const obj = Object.fromEntries(silenced)
    localStorage.setItem('silenced_alerts', JSON.stringify(obj))
  }, [silenced])

  useEffect(() => {
    localStorage.setItem('ignored_alertnames', JSON.stringify([...ignoredAlerts]))
  }, [ignoredAlerts])

  // 忽略告警（加入不关注列表）
  const ignoreAlert = (alertname: string) => {
    setIgnoredAlerts(prev => new Set(prev).add(alertname))
    Toast.show({ content: `已忽略 ${alertname}`, icon: 'success' })
  }
  // 取消忽略
  const unignoreAlert = (alertname: string) => {
    setIgnoredAlerts(prev => {
      const next = new Set(prev)
      next.delete(alertname)
      return next
    })
    Toast.show({ content: '已恢复关注', icon: 'success' })
  }

  // 确认告警
  const acknowledgeAlert = (alertId: string) => {
    setAcknowledged(prev => new Set(prev).add(alertId))
    Toast.show({ content: '已确认告警', icon: 'success' })
  }

  // 屏蔽告警（创建 Alertmanager Silence）
  const silenceAlert = async (alert: any, duration: string) => {
    const durationMap: Record<string, number> = {
      '30m': 30,
      '1h': 60,
      '6h': 360,
      '1d': 1440
    }
    const minutes = durationMap[duration] || 30
    const now = new Date()
    const endsAt = new Date(now.getTime() + minutes * 60 * 1000)

    // 构造 silence matchers（基于 alertname）
    const silence = {
      matchers: [
        { name: 'alertname', value: alert.alertname, isRegex: false, isEqual: true }
      ],
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      createdBy: 'mobile-ops',
      comment: `屏蔽 ${duration}（手机端创建）`
    }

    Toast.show({ icon: 'loading', content: '创建屏蔽中...', duration: 0 })
    try {
      // 使用默认 Alertmanager（ID=1）
      await api.createSilence(1, silence)
      Toast.clear()
      Toast.show({ icon: 'success', content: `已屏蔽 ${duration}` })
      // 刷新告警列表
      load()
    } catch (e) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
    }
  }

  // 取消静默（保留本地版本作为后备）
  const unsilenceAlert = (alertId: string) => {
    setSilenced(prev => {
      const next = new Map(prev)
      next.delete(alertId)
      return next
    })
    Toast.show({ content: '已取消静默', icon: 'success' })
  }

  // 获取告警唯一 ID
  const getAlertId = (a: any) => `${a.alertname}_${a.labels?.instance || ''}_${a.labels?.pod || ''}`

  // 执行告警查询（提取 generatorURL 里的 PromQL 并查询 VM）
  const executeQuery = async (alert: any) => {
    const generatorURL = alert.generator_url
    const query = extractPromQLFromURL(generatorURL)
    if (!query) {
      // 没有 generatorURL，用 alertname 构建查询
      const fallbackQuery = alert.alertname || ''
      if (!fallbackQuery) {
        Toast.show({ icon: 'fail', content: '无查询语句' })
        return
      }
      Toast.show({ content: `该告警无 generatorURL，请在 VMUI 手动查询: ${fallbackQuery}`, duration: 3000 })
      return
    }
    Toast.show({ icon: 'loading', content: '查询中...', duration: 0 })
    try {
      // 使用默认 VM 源（ID=1）
      const result = await api.vmQuery(1, query)
      Toast.clear()
      const formatted = formatPromResult(result)
      Dialog.alert({
        title: '查询结果',
        content: (
          <div style={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>PromQL:</div>
            <div style={{ marginBottom: 12, color: 'var(--primary)' }}>{query}</div>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>结果:</div>
            <div>{formatted}</div>
          </div>
        ),
        confirmText: '关闭'
      })
    } catch (e) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
    }
  }

  // 查看告警规则
  const viewAlertRule = async (alert: any) => {
    try {
      Toast.show({ icon: 'loading', content: '加载规则...', duration: 0 })
      const rules = await api.getVMRules(1).catch(() => null)
      Toast.clear()

      if (!rules || !rules.data || !rules.data.groups) {
        Toast.show({ content: '暂无法获取规则，请在 Grafana vmrules 查看', duration: 2000 })
        return
      }

      let matchedRule: any = null
      for (const group of rules.data.groups) {
        if (!group.rules) continue
        const found = group.rules.find((r: any) => r.name === alert.alertname || r.alert === alert.alertname)
        if (found) { matchedRule = found; break }
      }

      if (matchedRule) {
        Dialog.alert({
          title: alert.alertname,
          content: (
            <div style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '250px', overflowY: 'auto' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>表达式:</div>
              <div style={{ color: 'var(--primary)', marginBottom: 8 }}>{matchedRule.expr || matchedRule.query || 'N/A'}</div>
              {matchedRule.for && <div><b>持续:</b> {matchedRule.for}</div>}
              {matchedRule.labels && <div><b>标签:</b> {JSON.stringify(matchedRule.labels)}</div>}
            </div>
          ),
          confirmText: '关闭'
        })
      } else {
        Toast.show({ content: '未找到匹配规则', duration: 2000 })
      }
    } catch {
      Toast.clear()
      Toast.show({ icon: 'fail', content: '规则加载失败' })
    }
  }

  // 测试告警通知
  const testAlert = async (severity: 'critical' | 'warning') => {
    const testData = {
      id: Date.now(),
      title: severity === 'critical' ? '测试紧急告警' : '测试警告告警',
      message: severity === 'critical'
        ? '这是一条测试紧急告警，包含震动、声音、语音播报和悬浮窗'
        : '这是一条测试警告告警，包含震动和通知',
      severity,
      source: '测试来源'
    }

    try {
      await sendUrgentAlert(testData)
      Toast.show({ content: '测试告警已发送', icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e.message || '发送失败', icon: 'fail' })
    }
  }

  // 显示测试菜单
  const showTestMenu = () => {
    Dialog.show({
      title: '测试告警通知',
      content: (
        <div style={{ padding: '12px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>通知功能开关</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>语音播报（仅紧急告警）</span>
              <Switch
                checked={ttsOn}
                onChange={(checked) => {
                  setTtsOn(checked)
                  setTTSEnabled(checked)
                  Toast.show({ content: checked ? '已开启语音播报' : '已关闭语音播报' })
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>悬浮窗通知（仅紧急告警）</span>
              <Switch
                checked={floatingOn}
                onChange={async (checked) => {
                  if (checked && Capacitor.isNativePlatform()) {
                    const granted = await requestFloatingPermission()
                    if (!granted) {
                      Toast.show({ content: '请在系统设置中授予悬浮窗权限', duration: 3000 })
                      return
                    }
                  }
                  setFloatingOn(checked)
                  setFloatingAlertEnabled(checked)
                  Toast.show({ content: checked ? '已开启悬浮窗' : '已关闭悬浮窗' })
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>选择测试类型</div>
            <Button
              block
              color="danger"
              onClick={() => {
                Dialog.clear()
                testAlert('critical')
              }}
              style={{ marginBottom: 8 }}
            >
              测试紧急告警（震动+声音+播报+悬浮窗）
            </Button>
            <Button
              block
              color="warning"
              onClick={() => {
                Dialog.clear()
                testAlert('warning')
              }}
              style={{ marginBottom: 8 }}
            >
              测试警告告警（震动+通知）
            </Button>
            <Button
              block
              fill="outline"
              onClick={async () => {
                const success = await testTTS('这是语音播报测试')
                Toast.show({ content: success ? '播放成功' : '播放失败', icon: success ? 'success' : 'fail' })
              }}
            >
              测试语音播报
            </Button>
          </div>
        </div>
      ),
      closeOnMaskClick: true,
      actions: [{ key: 'close', text: '关闭' }]
    })
  }

  const firing = alerts.filter(a => a.status === 'firing')
  const critical = firing.filter(a => a.severity === 'critical')
  const warning = firing.filter(a => a.severity === 'warning')

  // === 告警分类策略（从 localStorage 读取配置） ===
  const alertFilterConfig = (() => {
    try {
      const saved = localStorage.getItem('alert_filter_config')
      return saved ? JSON.parse(saved) : {
        clusterValues: ['jyyun'],
        systemNameValues: [],
        staleDays: 3
      }
    } catch {
      return { clusterValues: ['jyyun'], systemNameValues: [], staleDays: 3 }
    }
  })()

  // 判断是否是"我的告警"
  const isMyAlert = (a: any) => {
    const cluster = a.labels?.cluster || ''
    const sysName = a.labels?.system_name || a.labels?.exported_system_name || ''
    const clusterMatch = alertFilterConfig.clusterValues.length === 0 || alertFilterConfig.clusterValues.includes(cluster)
    if (!clusterMatch) return false
    if (alertFilterConfig.systemNameValues.length === 0) return true
    return alertFilterConfig.systemNameValues.includes(sysName)
  }

  // 超过 N 天的告警自动归入已忽略
  const staleDays = alertFilterConfig.staleDays || 3
  const staleAlerts = alerts.filter(a => {
    if (a.status !== 'firing') return false
    if (ignoredAlerts.has(a.alertname)) return false
    const start = new Date(a.starts_at).getTime()
    const days = (Date.now() - start) / (1000 * 60 * 60 * 24)
    return days > staleDays
  })

  // 告警聚合：相同 alertname 的合并
  const aggregateAlerts = (alertList: any[]) => {
    const groups = new Map<string, any[]>()
    alertList.forEach(a => {
      const key = a.alertname
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(a)
    })
    return Array.from(groups.entries()).map(([name, items]) => ({
      alertname: name,
      count: items.length,
      items,
      severity: items.some(i => i.severity === 'critical') ? 'critical' : items[0].severity,
      status: items[0].status,
      summary: items[0].summary,
      starts_at: items[0].starts_at,
      labels: items[0].labels,
      annotations: items[0].annotations
    }))
  }

  const rawFiltered = tab === 'mine'
    ? alerts.filter(a => a.status === 'firing' && !ignoredAlerts.has(a.alertname) && isMyAlert(a) && !staleAlerts.includes(a))
    : tab === 'other'
    ? alerts.filter(a => a.status === 'firing' && !ignoredAlerts.has(a.alertname) && !isMyAlert(a) && !staleAlerts.includes(a))
    : tab === 'resolved'
    ? alerts.filter(a => a.status === 'resolved')
    : tab === 'silenced' ? alerts
    : tab === 'ignored'
    ? [...alerts.filter(a => ignoredAlerts.has(a.alertname)), ...staleAlerts]
    : alerts

  // namespace 过滤
  const nsFiltered = filterNamespace === 'all' ? rawFiltered
    : rawFiltered.filter(a => a.labels?.namespace === filterNamespace)

  // 自定义 label 过滤（格式: "key=value"）
  const labelFiltered = filterLabel === 'all' ? nsFiltered
    : nsFiltered.filter(a => {
        const [k, v] = filterLabel.split('=')
        return a.labels?.[k] === v
      })

  // 搜索过滤
  const searchFiltered = searchKeyword
    ? labelFiltered.filter(a =>
        a.alertname?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        a.summary?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        a.labels?.pod?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        a.labels?.namespace?.toLowerCase().includes(searchKeyword.toLowerCase())
      )
    : labelFiltered

  // 提取所有 namespace（用于过滤下拉）
  const allNamespaces = [...new Set(alerts.map(a => a.labels?.namespace).filter(Boolean))] as string[]

  // 只对 firing 状态的告警聚合，resolved 不聚合
  const aggregated = searchFiltered[0]?.status === 'firing' ? aggregateAlerts(searchFiltered) : searchFiltered

  // 分页
  const totalPages = Math.ceil(aggregated.length / pageSize)
  const filtered = aggregated.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // 切换 tab 或搜索时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [tab, searchKeyword, filterNamespace, filterLabel])

  const severityColor = (s: string) =>
    s === 'critical' ? 'var(--danger)' : s === 'warning' ? 'var(--warning)' : 'var(--accent-blue)'

  return (
    <div className="page">
      {/* 固定顶栏 */}
      <div style={{ flexShrink: 0 }}>
        <div className="page-header" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <span className="title">告警中心</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              size="mini"
              color="primary"
              fill="outline"
              onClick={showTestMenu}
            >
              测试
            </Button>
            <span className="text-xs">{firing.length} 活跃</span>
          </div>
        </div>

        {/* 搜索框 - 固定在顶部 */}
        <div style={{ padding: '8px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
          <input
            type="text"
            placeholder="搜索告警名称、摘要、Pod..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 13,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* 可滚动区域 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
      <PullToRefresh onRefresh={load}>
        <div style={{ padding: '0 12px 80px' }}>

          <Tabs activeKey={tab} onChange={setTab} style={{
            '--title-font-size': '12px',
            '--active-title-color': 'var(--accent-blue)',
            '--active-line-color': 'var(--accent-blue)'
          } as any}>
            <Tabs.Tab title={`我的 (${alerts.filter(a => a.status === 'firing' && !ignoredAlerts.has(a.alertname) && isMyAlert(a) && !staleAlerts.includes(a)).length})`} key="mine" />
            <Tabs.Tab title={`其他 (${alerts.filter(a => a.status === 'firing' && !ignoredAlerts.has(a.alertname) && !isMyAlert(a) && !staleAlerts.includes(a)).length})`} key="other" />
            <Tabs.Tab title={`已恢复 (${alerts.filter(a => a.status === 'resolved').length})`} key="resolved" />
            <Tabs.Tab title={`屏蔽 (${activeSilences.length})`} key="silenced" />
            <Tabs.Tab title={`已忽略 (${ignoredAlerts.size + staleAlerts.length})`} key="ignored" />
          </Tabs>

          {/* 过滤器 */}
          {allNamespaces.length > 0 && tab !== 'silenced' && tab !== 'ignored' && (
            <div style={{ display: 'flex', gap: 6, padding: '6px 0', overflowX: 'auto', flexWrap: 'nowrap' }}>
              <select
                value={filterNamespace}
                onChange={e => setFilterNamespace(e.target.value)}
                style={{
                  fontSize: 11, padding: '3px 6px', borderRadius: 6,
                  border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', flexShrink: 0
                }}
              >
                <option value="all">全部命名空间</option>
                {allNamespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
              </select>
              <select
                value={filterLabel}
                onChange={e => setFilterLabel(e.target.value)}
                style={{
                  fontSize: 11, padding: '3px 6px', borderRadius: 6,
                  border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', flexShrink: 0
                }}
              >
                <option value="all">全部标签</option>
                {[...new Set(alerts.flatMap(a => Object.entries(a.labels || {}).filter(([k]) => ['cluster', 'job', 'service'].includes(k)).map(([k, v]) => `${k}=${v}`)))].slice(0, 20).map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <div className="empty-title">暂无{tab === 'all' ? '' : '此类'}告警</div>
              <div className="empty-text">
                {searchKeyword ? '没有匹配的告警' : (
                  <>
                    配置 alertmanager webhook 到<br/>
                    <code style={{ color: 'var(--accent-blue)', fontSize: 11 }}>/api/v1/alerts/webhook</code>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {tab === 'silenced' ? (
                // 屏蔽列表
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeSilences.map(s => (
                    <div key={s.id} className="card" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            {s.matchers?.map((m: any) => `${m.name}=${m.value}`).join(', ')}
                          </div>
                          {s.comment && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                              {s.comment}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            创建者: {s.createdBy} | 过期: {new Date(s.endsAt).toLocaleString('zh-CN')}
                          </div>
                        </div>
                        <Button
                          size="mini"
                          color="danger"
                          fill="outline"
                          onClick={async () => {
                            const confirm = await Dialog.confirm({ content: '确认取消屏蔽？' })
                            if (!confirm) return
                            try {
                              await api.deleteSilence(1, s.id)
                              Toast.show({ icon: 'success', content: '已取消屏蔽' })
                              load()
                            } catch (e) {
                              Toast.show({ icon: 'fail', content: friendlyApiError(e) })
                            }
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ))}
                  {activeSilences.length === 0 && (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      暂无屏蔽规则
                    </div>
                  )}
                </div>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(a => (
                <div key={a.id} className="card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* 左侧状态点 */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: a.status === 'firing' ? severityColor(a.severity) : 'var(--success)',
                      flexShrink: 0,
                      boxShadow: a.status === 'firing' ? `0 0 4px ${severityColor(a.severity)}` : 'none'
                    }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 标题行 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{a.alertname}</span>
                          {a.count > 1 && (
                            <span style={{
                              background: severityColor(a.severity),
                              color: 'white',
                              fontSize: 9,
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: 8
                            }}>
                              ×{a.count}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmtRelative(a.starts_at)}</span>
                      </div>
                      {/* 摘要（截断一行） */}
                      {a.summary && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.summary}
                        </div>
                      )}
                      {/* namespace 标签 */}
                      {a.labels?.namespace && (
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3, marginTop: 2, display: 'inline-block' }}>
                          {a.labels.namespace}
                        </span>
                      )}
                      {staleAlerts.includes(a) && (
                        <span style={{ fontSize: 9, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '1px 4px', borderRadius: 3, marginTop: 2, marginLeft: 4, display: 'inline-block' }}>
                          超过{staleDays}天
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 折叠操作区 */}
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ fontSize: 10, color: 'var(--accent-blue)', cursor: 'pointer' }}>操作</summary>
                    <div style={{ marginTop: 6 }}>

                      {/* 快捷操作按钮 */}
                      {(a.status === 'firing' || tab === 'ignored') && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {!acknowledged.has(getAlertId(a)) ? (
                            <Button
                              size="mini"
                              color="primary"
                              fill="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                acknowledgeAlert(getAlertId(a))
                              }}
                              style={{ fontSize: 10, padding: '2px 8px' }}
                            >
                              ✓ 确认
                            </Button>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--success)', padding: '2px 8px' }}>✓ 已确认</span>
                          )}

                          {!silenced.has(getAlertId(a)) ? (
                            <Button
                              size="mini"
                              color="warning"
                              fill="outline"
                              onClick={async (e) => {
                                e.stopPropagation()
                                let selectedDuration = ''
                                await ActionSheet.show({
                                  actions: [
                                    { key: '30m', text: '30 分钟', onClick: () => { selectedDuration = '30m' } },
                                    { key: '1h', text: '1 小时', onClick: () => { selectedDuration = '1h' } },
                                    { key: '6h', text: '6 小时', onClick: () => { selectedDuration = '6h' } },
                                    { key: '1d', text: '1 天', onClick: () => { selectedDuration = '1d' } }
                                  ]
                                })
                                if (selectedDuration) {
                                  await silenceAlert(a, selectedDuration)
                                }
                              }}
                              style={{ fontSize: 10, padding: '2px 8px' }}
                            >
                              🔇 屏蔽
                            </Button>
                          ) : (
                            <Button
                              size="mini"
                              fill="none"
                              onClick={(e) => {
                                e.stopPropagation()
                                unsilenceAlert(getAlertId(a))
                              }}
                              style={{ fontSize: 10, padding: '2px 8px', color: 'var(--text-tertiary)' }}
                            >
                              🔊 已静音
                            </Button>
                          )}

                          {a.labels?.pod && (
                            <Button
                              size="mini"
                              fill="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                nav(`/logs?pod=${a.labels.pod}`)
                              }}
                              style={{ fontSize: 10, padding: '2px 8px' }}
                            >
                              📋 日志
                            </Button>
                          )}

                          {a.labels?.instance && (
                            <Button
                              size="mini"
                              fill="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                nav(`/monitor?instance=${a.labels.instance}`)
                              }}
                              style={{ fontSize: 10, padding: '2px 8px' }}
                            >
                              📊 监控
                            </Button>
                          )}

                          <Button
                            size="mini"
                            fill="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              shareAlertCard({
                                alertname: a.alertname,
                                severity: a.severity,
                                cluster: a.labels?.cluster,
                                namespace: a.labels?.namespace,
                                pod: a.labels?.pod,
                                summary: a.summary,
                                starts_at: a.starts_at
                              })
                            }}
                            style={{ fontSize: 10, padding: '2px 8px' }}
                          >
                            📤 分享
                          </Button>

                          <Button
                            size="mini"
                            color="primary"
                            fill="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              executeQuery(a)
                            }}
                            style={{ fontSize: 10, padding: '2px 8px' }}
                          >
                            🔍 查询
                          </Button>

                          <Button
                            size="mini"
                            fill="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              viewAlertRule(a)
                            }}
                            style={{ fontSize: 10, padding: '2px 8px' }}
                          >
                            📋 规则
                          </Button>

                          {tab !== 'ignored' ? (
                            <Button
                              size="mini"
                              fill="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                ignoreAlert(a.alertname)
                              }}
                              style={{ fontSize: 10, padding: '2px 8px', color: 'var(--text-tertiary)' }}
                            >
                              🚫 忽略
                            </Button>
                          ) : (
                            <Button
                              size="mini"
                              color="success"
                              fill="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                unignoreAlert(a.alertname)
                              }}
                              style={{ fontSize: 10, padding: '2px 8px' }}
                            >
                              ✓ 恢复关注
                            </Button>
                          )}
                        </div>
                      )}

                      {/* 🤖 智能诊断卡片 */}
                      {(() => {
                        const analysis = analyzeAlert(a)
                        if (!analysis) return null
                        return (
                          <details style={{ marginTop: 10 }}>
                            <summary style={{
                              fontSize: 11,
                              color: 'var(--accent-blue)',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              background: 'var(--accent-blue-bg)',
                              borderRadius: 4,
                              display: 'inline-block'
                            }}>
                              🤖 智能诊断建议
                            </summary>
                            <div style={{
                              marginTop: 6,
                              padding: 8,
                              background: 'var(--bg-secondary)',
                              borderRadius: 6,
                              fontSize: 11,
                              lineHeight: 1.6
                            }}>
                              <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 6 }}>
                                根因: {analysis.rootCause}
                              </div>

                              <div style={{ marginBottom: 6 }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>可能原因:</div>
                                <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-secondary)' }}>
                                  {analysis.possibleCauses.map((c, i) => <li key={i}>{c}</li>)}
                                </ul>
                              </div>

                              <div style={{ marginBottom: 6 }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>建议:</div>
                                <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-secondary)' }}>
                                  {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                              </div>

                              {analysis.docLink && (
                                <div style={{ marginTop: 6 }}>
                                  <a
                                    href={analysis.docLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: 10, color: 'var(--accent-blue)' }}
                                  >
                                    📖 相关文档
                                  </a>
                                </div>
                              )}
                            </div>
                          </details>
                        )
                      })()}

                      {/* 查看详情（弹窗） */}
                      {(a.labels || a.annotations || a.count > 1) && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            Dialog.alert({
                              title: a.alertname,
                              content: (
                                <div style={{ fontSize: 11, maxHeight: '60vh', overflowY: 'auto', lineHeight: 1.6 }}>
                                  {a.count > 1 ? (
                                    <div>
                                      <div style={{ fontWeight: 600, marginBottom: 6 }}>受影响实例 ({a.count}):</div>
                                      {a.items.map((item: any, idx: number) => (
                                        <div key={idx} style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 4, marginBottom: 4, borderLeft: `3px solid ${severityColor(item.severity)}` }}>
                                          {item.labels?.pod && <div><b>Pod:</b> {item.labels.pod}</div>}
                                          {item.labels?.instance && <div><b>实例:</b> {item.labels.instance}</div>}
                                          {item.labels?.namespace && <div><b>NS:</b> {item.labels.namespace}</div>}
                                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>开始: {fmtTime(item.starts_at)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div>
                                      {a.labels && Object.entries(a.labels).map(([k, v]) => (
                                        <div key={k}><b>{k}:</b> {String(v)}</div>
                                      ))}
                                      {a.annotations && Object.entries(a.annotations).map(([k, v]) => (
                                        <div key={k} style={{ marginTop: 4 }}><b>{k}:</b> {String(v)}</div>
                                      ))}
                                      <div style={{ marginTop: 6 }}>开始: {fmtTime(a.starts_at)}</div>
                                      {a.ends_at && <div>恢复: {fmtTime(a.ends_at)}</div>}
                                      {a.generator_url && <div style={{ marginTop: 4, fontSize: 10, wordBreak: 'break-all', color: 'var(--accent-blue)' }}>{a.generator_url}</div>}
                                    </div>
                                  )}
                                </div>
                              ),
                              confirmText: '关闭'
                            })
                          }}
                          style={{ fontSize: 10, color: 'var(--accent-blue)', cursor: 'pointer', marginTop: 4, display: 'inline-block' }}
                        >
                          查看详情 {a.count > 1 ? `(${a.count} 个实例)` : ''}
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              ))}
            </div>
              )}

            {/* 分页控件 */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
                padding: '16px 0',
                marginTop: 8
              }}>
                <Button
                  size="small"
                  fill="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {currentPage} / {totalPages}
                </span>
                <Button
                  size="small"
                  fill="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
          )}
        </div>
      </PullToRefresh>
      </div>
    </div>
  )
}
