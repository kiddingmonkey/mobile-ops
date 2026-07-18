import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Tabs, Card, Tag, List, Toast, PullToRefresh, Button, Dialog } from 'antd-mobile'
import { ClockCircleOutline, CheckCircleOutline, CloseCircleOutline } from 'antd-mobile-icons'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'
import { shareLog, downloadLog, makeLogFilename } from '@/utils/logShare'
import { sharePodCard } from '@/utils/shareCard'
import { hapticMedium, hapticHeavy, hapticSuccess, hapticError } from '@/utils/haptics'
import MetricsTab from './PodMetrics'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export default function PodDetailPage() {
  const nav = useNavigate()
  const { clusterId, namespace, name } = useParams<{ clusterId: string; namespace: string; name: string }>()
  const [tab, setTab] = useState('detail')
  const [detail, setDetail] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [logs, setLogs] = useState('')
  const [yaml, setYaml] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (clusterId && namespace && name) {
      loadDetail()
    }
  }, [clusterId, namespace, name])

  useEffect(() => {
    if (tab === 'events' && events.length === 0) loadEvents()
    if (tab === 'logs' && !logs) loadLogs()
    if (tab === 'yaml' && !yaml) loadYaml()
  }, [tab])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const d = await api.getPodDetail(Number(clusterId), namespace!, name!)
      setDetail(d)
    } catch (e: any) {
      Toast.show({ content: e?.message || '加载失败', icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const ev = await api.getPodEvents(Number(clusterId), namespace!, name!)
      setEvents(ev)
    } catch (e: any) {
      Toast.show({ content: '加载事件失败', icon: 'fail' })
    }
  }

  const loadLogs = async (container?: string, tail: number = 500, previous: boolean = false) => {
    try {
      Toast.show({ content: '加载日志...', icon: 'loading', duration: 0 })
      const r = await api.getPodLogs(Number(clusterId), namespace!, name!, container, tail, previous)
      // 兼容多种返回格式
      const logText = typeof r === 'string' ? r : (r?.logs || r?.data || '')
      setLogs(logText)
      Toast.clear()
      if (!logText) {
        Toast.show({ content: previous ? '没有上次崩溃的日志' : '暂无日志', icon: 'fail' })
      }
    } catch (e: any) {
      Toast.clear()
      Toast.show({ content: '加载日志失败: ' + (e?.response?.data?.error || e?.message || ''), icon: 'fail' })
    }
  }

  const loadYaml = async () => {
    try {
      const resp = await (api as any).http.get(`/clusters/${clusterId}/resources/pods/yaml`, { params: { namespace, name } })
      setYaml(resp.data)
    } catch (e: any) {
      Toast.show({ content: '加载 YAML 失败', icon: 'fail' })
    }
  }

  const refresh = async () => {
    await loadDetail()
    if (tab === 'events') await loadEvents()
  }

  if (!detail) {
    return (
      <PageShell title="Pod 详情" onBack={() => nav(-1)}>
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          加载中...
        </div>
      </PageShell>
    )
  }

  // 快捷操作
  const podRestart = async () => {
    hapticHeavy()
    const ok = await Dialog.confirm({
      content: `确认删除并重建 Pod "${name}"？（等同于滚动重启）`,
      confirmText: '重启',
      cancelText: '取消'
    })
    if (!ok) return
    try {
      await (api as any).delete(`/clusters/${clusterId}/pods/${namespace}/${name}`)
      hapticSuccess()
      Toast.show({ content: '已触发重启，Deployment 会拉起新 Pod', icon: 'success' })
      setTimeout(() => nav(-1), 1500)
    } catch (e: any) {
      hapticError()
      Toast.show({ content: '重启失败: ' + (e?.response?.data?.error || e?.message || ''), icon: 'fail' })
    }
  }

  const downloadPodLogs = async () => {
    hapticMedium()
    try {
      Toast.show({ content: '下载日志...', icon: 'loading', duration: 0 })
      const r = await api.getPodLogs(Number(clusterId), namespace!, name!, undefined, 5000)
      Toast.clear()
      const text = typeof r === 'string' ? r : (r?.logs || r?.data || '')
      if (!text) {
        Toast.show({ content: '暂无日志', icon: 'fail' })
        return
      }
      await downloadLog(text, makeLogFilename(name || 'pod'))
      hapticSuccess()
      Toast.show({ content: '已下载', icon: 'success' })
    } catch (e: any) {
      Toast.clear()
      hapticError()
      Toast.show({ content: '下载失败: ' + (e?.message || ''), icon: 'fail' })
    }
  }

  return (
    <PageShell title={name || 'Pod'} onBack={() => nav(-1)}>
      {/* 顶部固定操作栏 */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '8px 12px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        <Button
          size="small"
          color="primary"
          onClick={() => setTab('metrics')}
          style={{ flexShrink: 0, fontSize: 12 }}
        >
          📊 监控
        </Button>
        <Button
          size="small"
          color="primary"
          fill="outline"
          onClick={() => { setTab('logs'); setTimeout(() => loadLogs(), 100) }}
          style={{ flexShrink: 0, fontSize: 12 }}
        >
          📋 日志
        </Button>
        <Button
          size="small"
          color="primary"
          fill="outline"
          onClick={() => setTab('terminal')}
          style={{ flexShrink: 0, fontSize: 12 }}
        >
          💻 终端
        </Button>
        <Button
          size="small"
          fill="outline"
          onClick={downloadPodLogs}
          style={{ flexShrink: 0, fontSize: 12 }}
        >
          📥 下载日志
        </Button>
        <Button
          size="small"
          fill="outline"
          onClick={async () => {
            hapticMedium()
            await sharePodCard({
              cluster: `集群 ${clusterId}`,
              namespace: namespace || '',
              name: name || '',
              status: detail.phase || '',
              restarts: detail.total_restarts,
              node: detail.node,
              age: detail.created_at ? dayjs(detail.created_at).fromNow() : ''
            })
          }}
          style={{ flexShrink: 0, fontSize: 12 }}
        >
          📤 分享
        </Button>
        <Button
          size="small"
          color="danger"
          fill="outline"
          onClick={podRestart}
          style={{ flexShrink: 0, fontSize: 12 }}
        >
          🔄 重启
        </Button>
      </div>

      <PullToRefresh onRefresh={refresh}>
        <div style={{ background: 'var(--background)', minHeight: '100vh' }}>
          <Tabs activeKey={tab} onChange={setTab} style={{ '--title-font-size': '14px' }}>
            <Tabs.Tab title="详情" key="detail">
              <DetailTab detail={detail} />
            </Tabs.Tab>
            <Tabs.Tab title="容器" key="containers">
              <ContainersTab
                detail={detail}
                onSelectLog={(containerName) => {
                  setTab('logs')
                  setTimeout(() => loadLogs(containerName), 100)
                }}
              />
            </Tabs.Tab>
            <Tabs.Tab title="事件" key="events">
              <EventsTab events={events} />
            </Tabs.Tab>
            <Tabs.Tab title="监控" key="metrics">
              <MetricsTab
                clusterId={Number(clusterId)}
                namespace={namespace!}
                podName={name!}
                detail={detail}
              />
            </Tabs.Tab>
            <Tabs.Tab title="日志" key="logs">
              <LogsTab
                logs={logs}
                containers={detail.containers}
                podName={name || ''}
                onLoad={loadLogs}
              />
            </Tabs.Tab>
            <Tabs.Tab title="文件" key="files">
              <FilesTab
                clusterId={Number(clusterId)}
                namespace={namespace!}
                podName={name!}
                containers={detail.containers || []}
              />
            </Tabs.Tab>
            <Tabs.Tab title="终端" key="terminal">
              <TerminalTab
                clusterId={Number(clusterId)}
                namespace={namespace!}
                podName={name!}
                containers={detail.containers || []}
              />
            </Tabs.Tab>
            <Tabs.Tab title="YAML" key="yaml">
              <YamlTab yaml={yaml} />
            </Tabs.Tab>
          </Tabs>
        </div>
      </PullToRefresh>
    </PageShell>
  )
}

// 详情 Tab
function DetailTab({ detail }: { detail: any }) {
  const phaseColor = (p: string) => {
    if (p === 'Running') return 'success'
    if (p === 'Pending') return 'warning'
    if (p === 'Succeeded') return 'primary'
    return 'danger'
  }

  return (
    <div style={{ padding: '12px 12px 60px' }}>
      {/* 状态卡片 */}
      <Card title="状态" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <Tag color={phaseColor(detail.phase)}>{detail.phase}</Tag>
          <Tag color="default">{detail.qos_class || 'BestEffort'}</Tag>
          {detail.total_restarts > 0 && (
            <Tag color="warning">重启 {detail.total_restarts} 次</Tag>
          )}
        </div>
        <InfoRow label="创建时间" value={dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')} />
        {detail.started_at && (
          <InfoRow label="启动时间" value={dayjs(detail.started_at).format('YYYY-MM-DD HH:mm:ss')} />
        )}
        {detail.last_restart_at && (
          <InfoRow label="最近重启" value={dayjs(detail.last_restart_at).fromNow()} />
        )}
      </Card>

      {/* 基础信息 */}
      <Card title="基础信息" style={{ marginBottom: 12 }}>
        <InfoRow label="Namespace" value={detail.namespace} />
        <InfoRow label="节点" value={detail.node || '-'} />
        <InfoRow label="Pod IP" value={detail.pod_ip || '-'} />
        <InfoRow label="Host IP" value={detail.host_ip || '-'} />
        <InfoRow label="Service Account" value={detail.service_account || 'default'} />
        <InfoRow label="Restart Policy" value={detail.restart_policy || 'Always'} />
      </Card>

      {/* Labels */}
      {detail.labels && Object.keys(detail.labels).length > 0 && (
        <Card title="Labels" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(detail.labels).map(([k, v]: [string, any]) => (
              <Tag key={k} color="primary" style={{ fontSize: 11 }}>
                {k}={v}
              </Tag>
            ))}
          </div>
        </Card>
      )}

      {/* 资源汇总 */}
      {(detail.total_requests || detail.total_limits) && (
        <Card title="资源需求" style={{ marginBottom: 12 }}>
          {detail.total_requests && (
            <InfoRow
              label="Requests"
              value={`CPU: ${detail.total_requests.cpu || '-'} / Memory: ${detail.total_requests.memory || '-'}`}
            />
          )}
          {detail.total_limits && (
            <InfoRow
              label="Limits"
              value={`CPU: ${detail.total_limits.cpu || '-'} / Memory: ${detail.total_limits.memory || '-'}`}
            />
          )}
          {detail.priority_class_name && (
            <InfoRow label="PriorityClass" value={detail.priority_class_name} />
          )}
        </Card>
      )}

      {/* 调度信息 */}
      {(detail.node_selector || detail.tolerations || detail.affinity) && (
        <Card title="调度信息" style={{ marginBottom: 12 }}>
          {/* NodeSelector */}
          {detail.node_selector && Object.keys(detail.node_selector).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>NodeSelector</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Object.entries(detail.node_selector).map(([k, v]: [string, any]) => (
                  <Tag key={k} color="primary" style={{ fontSize: 10 }}>
                    {k}={String(v)}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Affinity */}
          {detail.affinity && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Affinity</div>
              {detail.affinity.node_affinity && (
                <InfoRow label="Node" value={detail.affinity.node_affinity} />
              )}
              {detail.affinity.pod_affinity && (
                <InfoRow label="Pod" value={detail.affinity.pod_affinity} />
              )}
              {detail.affinity.pod_anti_affinity && (
                <InfoRow label="PodAnti" value={detail.affinity.pod_anti_affinity} />
              )}
            </div>
          )}

          {/* Tolerations */}
          {detail.tolerations && detail.tolerations.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                Tolerations ({detail.tolerations.length})
              </div>
              {detail.tolerations.slice(0, 5).map((t: any, i: number) => (
                <div key={i} style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--text-secondary)', marginBottom: 2 }}>
                  {t.key || '*'} {t.operator} {t.value || ''} → {t.effect || '*'}
                </div>
              ))}
              {detail.tolerations.length > 5 && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>...还有 {detail.tolerations.length - 5} 条</div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Volumes */}
      {detail.volumes && detail.volumes.length > 0 && (
        <Card title={`Volumes (${detail.volumes.length})`} style={{ marginBottom: 12 }}>
          {detail.volumes.map((v: any, i: number) => (
            <div key={i} style={{ marginBottom: 6, fontSize: 12, display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <Tag color="primary" style={{ fontSize: 10 }}>{v.type}</Tag>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v.name}</span>
              {v.source && (
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11, wordBreak: 'break-all' }}>
                  → {v.source}
                </span>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Conditions */}
      {detail.conditions && detail.conditions.length > 0 && (
        <Card title="Conditions" style={{ marginBottom: 12 }}>
          {detail.conditions.map((c: any, i: number) => (
            <div key={i} style={{ marginBottom: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {c.status === 'True' ? (
                  <CheckCircleOutline color="var(--success)" fontSize={14} />
                ) : (
                  <CloseCircleOutline color="var(--text-disabled)" fontSize={14} />
                )}
                <span style={{ fontWeight: 600 }}>{c.type}</span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                  {c.status}
                </span>
              </div>
              {c.reason && (
                <div style={{ marginLeft: 20, color: 'var(--text-tertiary)', fontSize: 11 }}>
                  {c.reason}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// 容器 Tab
function ContainersTab({ detail, onSelectLog }: { detail: any; onSelectLog: (c: string) => void }) {
  const stateColor = (s: string) => {
    if (s === 'running') return 'success'
    if (s === 'waiting') return 'warning'
    return 'danger'
  }

  const containers = [...(detail.containers || []), ...(detail.init_containers || [])]

  return (
    <div style={{ padding: '12px 12px 60px' }}>
      {containers.map((c: any) => (
        <Card key={c.name} title={c.name} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <Tag color={stateColor(c.state)}>{c.state}</Tag>
            {c.ready && <Tag color="success">Ready</Tag>}
            {c.restart_count > 0 && <Tag color="warning">重启 {c.restart_count}</Tag>}
          </div>
          <InfoRow label="镜像" value={c.image} style={{ fontSize: 11 }} />
          {c.reason && <InfoRow label="原因" value={c.reason} />}
          {c.started_at && (
            <InfoRow label="启动于" value={dayjs(c.started_at).format('YYYY-MM-DD HH:mm:ss')} />
          )}
          {c.requests && (
            <InfoRow
              label="Requests"
              value={`CPU: ${c.requests.cpu || '-'} / Memory: ${c.requests.memory || '-'}`}
            />
          )}
          {c.limits && (
            <InfoRow
              label="Limits"
              value={`CPU: ${c.limits.cpu || '-'} / Memory: ${c.limits.memory || '-'}`}
            />
          )}
          <div style={{ marginTop: 8 }}>
            <a
              onClick={() => onSelectLog(c.name)}
              style={{ fontSize: 12, color: 'var(--accent-blue)' }}
            >
              查看日志 →
            </a>
          </div>
        </Card>
      ))}
    </div>
  )
}

// 事件 Tab
function EventsTab({ events }: { events: any[] }) {
  return (
    <div style={{ padding: '12px 12px 60px' }}>
      {events.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 32 }}>
          暂无事件
        </div>
      )}
      {events.map((ev, i) => (
        <Card
          key={i}
          style={{
            marginBottom: 8,
            borderLeft: `3px solid ${ev.type === 'Warning' ? 'var(--danger)' : 'var(--text-disabled)'}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                {ev.reason}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                {ev.message}
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span>{dayjs(ev.last_at).fromNow()}</span>
                {ev.count > 1 && <span>× {ev.count}</span>}
                {ev.source && <span>{ev.source}</span>}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// 日志 Tab
function LogsTab({ logs, containers, podName, onLoad }: {
  logs: string
  containers: any[]
  podName: string
  onLoad: (container?: string, tail?: number, previous?: boolean) => Promise<void>
}) {
  const [selectedContainer, setSelectedContainer] = useState<string>(containers?.[0]?.name || '')
  const [tail, setTail] = useState<number>(500)
  const [previous, setPrevious] = useState<boolean>(false)
  const [fontSize, setFontSize] = useState<number>(9)

  const doLoad = async () => {
    await onLoad(selectedContainer, tail, previous)
  }

  const doShare = async () => {
    if (!logs) {
      Toast.show({ content: '没有日志可分享', icon: 'fail' })
      return
    }
    try {
      const filename = makeLogFilename(`${podName}_${selectedContainer || 'default'}${previous ? '_previous' : ''}`)
      await shareLog({
        content: logs,
        filename,
        title: `Pod日志 - ${podName}`
      })
    } catch (e: any) {
      Toast.show({ content: '分享失败: ' + (e?.message || ''), icon: 'fail' })
    }
  }

  const doDownload = async () => {
    if (!logs) {
      Toast.show({ content: '没有日志可下载', icon: 'fail' })
      return
    }
    const filename = makeLogFilename(`${podName}_${selectedContainer || 'default'}${previous ? '_previous' : ''}`)
    const result = await downloadLog(logs, filename)
    if (result) {
      Toast.show({ content: '已保存到: ' + filename, icon: 'success', duration: 2000 })
    } else {
      Toast.show({ content: '下载失败', icon: 'fail' })
    }
  }

  const TAIL_OPTIONS = [100, 200, 500, 1000, 2000]

  return (
    <div style={{ padding: '10px 10px 60px' }}>
      {/* 控制栏 */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8
      }}>
        {/* 容器选择 */}
        {containers && containers.length > 1 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>容器</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {containers.map((c: any) => (
                <span
                  key={c.name}
                  onClick={() => setSelectedContainer(c.name)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    cursor: 'pointer',
                    background: selectedContainer === c.name ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                    color: selectedContainer === c.name ? '#fff' : 'var(--text-primary)',
                    border: '1px solid ' + (selectedContainer === c.name ? 'var(--accent-blue)' : 'var(--border-color)')
                  }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 行数选择 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>显示行数</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TAIL_OPTIONS.map(n => (
              <span
                key={n}
                onClick={() => setTail(n)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  background: tail === n ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                  color: tail === n ? '#fff' : 'var(--text-primary)',
                  border: '1px solid ' + (tail === n ? 'var(--accent-blue)' : 'var(--border-color)')
                }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* 日志类型 + 字体大小 */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <span
            onClick={() => setPrevious(false)}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 11,
              cursor: 'pointer',
              background: !previous ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: !previous ? '#fff' : 'var(--text-primary)',
              border: '1px solid ' + (!previous ? 'var(--accent-blue)' : 'var(--border-color)')
            }}
          >
            当前日志
          </span>
          <span
            onClick={() => setPrevious(true)}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 11,
              cursor: 'pointer',
              background: previous ? 'var(--warning)' : 'var(--bg-secondary)',
              color: previous ? '#fff' : 'var(--text-primary)',
              border: '1px solid ' + (previous ? 'var(--warning)' : 'var(--border-color)')
            }}
          >
            上次崩溃(-p)
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>字体</span>
          <span
            onClick={() => setFontSize(Math.max(7, fontSize - 1))}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              minWidth: 24,
              textAlign: 'center'
            }}
          >A-</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 22, textAlign: 'center' }}>{fontSize}</span>
          <span
            onClick={() => setFontSize(Math.min(20, fontSize + 1))}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              minWidth: 24,
              textAlign: 'center'
            }}
          >A+</span>
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 6 }}>
          <Button color="primary" size="mini" onClick={doLoad} style={{ flex: 1 }}>
            加载日志
          </Button>
          <Button size="mini" onClick={doDownload} disabled={!logs}>
            📥 下载
          </Button>
          <Button size="mini" color="primary" fill="outline" onClick={doShare} disabled={!logs}>
            📤 分享
          </Button>
        </div>
      </div>

      {/* 日志内容 */}
      <div style={{
        background: '#1E293B',
        color: '#E2E8F0',
        borderRadius: 8,
        padding: 8,
        fontSize,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        overflowX: 'auto',
        maxHeight: '65vh',
        overflowY: 'auto',
        lineHeight: 1.4
      }}>
        {logs ? (
          logs.split('\n').map((line, i) => {
            const isError = /ERROR|FATAL|CRITICAL|Exception|exception|error|fail|failed/i.test(line)
            return (
              <div
                key={i}
                style={{
                  background: isError ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
                  color: isError ? '#FCA5A5' : '#E2E8F0',
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
          '点击"加载日志"按钮查看容器日志'
        )}
      </div>
    </div>
  )
}

// YAML Tab
function YamlTab({ yaml }: { yaml: any }) {
  return (
    <div style={{ padding: '12px 12px 60px' }}>
      <pre style={{
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        background: '#1E293B',
        color: '#F8FAFC',
        padding: 12,
        borderRadius: 8,
        overflow: 'auto',
        maxHeight: '70vh'
      }}>
        {yaml ? JSON.stringify(yaml, null, 2) : '加载中...'}
      </pre>
    </div>
  )
}

function InfoRow({ label, value, style }: { label: string; value: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', marginBottom: 6, fontSize: 12, ...style }}>
      <span style={{ color: 'var(--text-tertiary)', minWidth: 100 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', flex: 1, wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

// 文件浏览 Tab
function FilesTab({ clusterId, namespace, podName, containers }: {
  clusterId: number
  namespace: string
  podName: string
  containers: any[]
}) {
  const [selectedContainer, setSelectedContainer] = useState<string>(containers?.[0]?.name || '')
  const [currentPath, setCurrentPath] = useState<string>('/')
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fileContent, setFileContent] = useState<string>('')
  const [viewingFile, setViewingFile] = useState<string>('')
  const [fontSize, setFontSize] = useState<number>(10)

  const loadDir = async (path: string) => {
    if (!selectedContainer) {
      Toast.show({ content: '请先选择容器', icon: 'fail' })
      return
    }
    setLoading(true)
    setViewingFile('')
    setFileContent('')
    try {
      const r = await api.listPodFiles(clusterId, namespace, podName, selectedContainer, path)
      setEntries(r.entries || [])
      setCurrentPath(r.path || path)
    } catch (e: any) {
      Toast.show({ content: '加载失败: ' + (e?.response?.data?.error || e?.message), icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedContainer) loadDir('/')
  }, [selectedContainer])

  const goUp = () => {
    if (currentPath === '/' || currentPath === '') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    const parent = '/' + parts.join('/')
    loadDir(parent || '/')
  }

  const openEntry = (entry: any) => {
    if (entry.is_dir) {
      loadDir(entry.path)
    } else {
      viewFile(entry.path)
    }
  }

  const viewFile = async (path: string) => {
    setLoading(true)
    try {
      const r = await api.getPodFile(clusterId, namespace, podName, selectedContainer, path)
      setFileContent(r.content || '')
      setViewingFile(path)
    } catch (e: any) {
      Toast.show({ content: '读取失败: ' + (e?.response?.data?.error || e?.message), icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = async () => {
    if (!viewingFile || !fileContent) return
    const parts = viewingFile.split('/')
    const filename = parts[parts.length - 1] || 'file.txt'
    const result = await downloadLog(fileContent, filename)
    Toast.show({ content: result ? '已下载' : '下载失败', icon: result ? 'success' : 'fail' })
  }

  const shareFile = async () => {
    if (!viewingFile || !fileContent) return
    const parts = viewingFile.split('/')
    const filename = parts[parts.length - 1] || 'file.txt'
    try {
      await shareLog({ content: fileContent, filename, title: `文件 - ${filename}` })
    } catch {
      Toast.show({ content: '分享失败', icon: 'fail' })
    }
  }

  return (
    <div style={{ padding: '10px 10px 60px' }}>
      {/* 容器选择 */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8
      }}>
        {containers.length > 1 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>容器</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {containers.map((c: any) => (
                <span
                  key={c.name}
                  onClick={() => setSelectedContainer(c.name)}
                  style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                    background: selectedContainer === c.name ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                    color: selectedContainer === c.name ? '#fff' : 'var(--text-primary)',
                    border: '1px solid ' + (selectedContainer === c.name ? 'var(--accent-blue)' : 'var(--border-color)')
                  }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 路径导航 */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <Button size="mini" onClick={goUp} disabled={currentPath === '/' || currentPath === ''}>
            ⬆️ 上级
          </Button>
          <Button size="mini" onClick={() => loadDir('/')}>
            🏠 根目录
          </Button>
          <Button size="mini" onClick={() => loadDir(currentPath)}>
            🔄 刷新
          </Button>
        </div>
        <div style={{
          fontSize: 11,
          fontFamily: 'ui-monospace, monospace',
          color: 'var(--text-secondary)',
          wordBreak: 'break-all',
          background: 'var(--bg-secondary)',
          padding: '4px 8px',
          borderRadius: 4
        }}>
          📁 {currentPath}
        </div>

        {/* 常用路径 */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {['/var/log', '/tmp', '/app', '/etc', '/root', '/home'].map(p => (
            <span
              key={p}
              onClick={() => loadDir(p)}
              style={{
                padding: '2px 6px', fontSize: 10, cursor: 'pointer',
                background: 'var(--bg-secondary)', color: 'var(--accent-blue)',
                borderRadius: 3, border: '1px solid var(--border-color)'
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* 文件内容查看 */}
      {viewingFile ? (
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          padding: 10
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', flex: 1 }}>
              📄 {viewingFile}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span
                onClick={() => setFontSize(Math.max(7, fontSize - 1))}
                style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer',
                  background: 'var(--bg-secondary)', borderRadius: 3, border: '1px solid var(--border-color)' }}
              >A-</span>
              <span
                onClick={() => setFontSize(Math.min(20, fontSize + 1))}
                style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer',
                  background: 'var(--bg-secondary)', borderRadius: 3, border: '1px solid var(--border-color)' }}
              >A+</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <Button size="mini" onClick={downloadFile}>📥 下载</Button>
            <Button size="mini" color="primary" fill="outline" onClick={shareFile}>📤 分享</Button>
            <Button size="mini" onClick={() => { setViewingFile(''); setFileContent('') }}>← 返回列表</Button>
          </div>
          <div style={{
            background: '#1E293B',
            color: '#E2E8F0',
            padding: 8,
            borderRadius: 6,
            fontSize,
            fontFamily: 'ui-monospace, monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: '60vh',
            overflowY: 'auto'
          }}>
            {fileContent ? (
              fileContent.split('\n').map((line, i) => {
                const isError = /ERROR|FATAL|CRITICAL|Exception|exception|error|fail|failed/i.test(line)
                return (
                  <div
                    key={i}
                    style={{
                      background: isError ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
                      color: isError ? '#FCA5A5' : '#E2E8F0',
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
              '(空文件)'
            )}
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          padding: 8,
          minHeight: 200
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>加载中...</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>空目录</div>
          ) : (
            entries.map((e: any, i: number) => (
              <div
                key={i}
                onClick={() => openEntry(e)}
                style={{
                  padding: '6px 8px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span style={{ fontSize: 14 }}>{e.is_dir ? '📁' : '📄'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{e.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {e.permissions} · {e.size} B {e.mod_time && '· ' + e.mod_time}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// 终端 Tab
function TerminalTab({ clusterId, namespace, podName, containers }: {
  clusterId: number
  namespace: string
  podName: string
  containers: any[]
}) {
  const [selectedContainer, setSelectedContainer] = useState<string>(containers?.[0]?.name || '')
  const [command, setCommand] = useState<string>('')
  const [history, setHistory] = useState<Array<{ cmd: string; stdout: string; stderr: string; error?: string; time: string }>>([])
  const [executing, setExecuting] = useState(false)
  const [fontSize, setFontSize] = useState<number>(11)

  const runCommand = async () => {
    if (!command.trim()) return
    if (!selectedContainer) {
      Toast.show({ content: '请先选择容器', icon: 'fail' })
      return
    }

    // 支持简单shell命令 (sh -c)
    const cmdArgs = ['sh', '-c', command]
    const time = new Date().toLocaleTimeString()

    setExecuting(true)
    try {
      const result = await api.execInPod(clusterId, namespace, podName, selectedContainer, cmdArgs)
      setHistory(h => [...h, {
        cmd: command,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error,
        time
      }])
      setCommand('')
    } catch (e: any) {
      setHistory(h => [...h, {
        cmd: command,
        stdout: '',
        stderr: '',
        error: e?.response?.data?.error || e?.message || '执行失败',
        time
      }])
    } finally {
      setExecuting(false)
    }
  }

  const clearHistory = () => setHistory([])

  const QUICK_CMDS = ['ls -la', 'pwd', 'df -h', 'free -h', 'ps aux', 'env', 'cat /etc/hostname']

  return (
    <div style={{ padding: '10px 10px 60px' }}>
      {/* 容器选择 */}
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8
      }}>
        {containers.length > 1 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>容器</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {containers.map((c: any) => (
                <span
                  key={c.name}
                  onClick={() => setSelectedContainer(c.name)}
                  style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                    background: selectedContainer === c.name ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                    color: selectedContainer === c.name ? '#fff' : 'var(--text-primary)',
                    border: '1px solid ' + (selectedContainer === c.name ? 'var(--accent-blue)' : 'var(--border-color)')
                  }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 命令输入 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            type="text"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runCommand() }}
            placeholder="输入命令，如: ls -la"
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'ui-monospace, monospace'
            }}
          />
          <Button color="primary" size="small" onClick={runCommand} loading={executing}>
            执行
          </Button>
        </div>

        {/* 快捷命令 */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {QUICK_CMDS.map(c => (
            <span
              key={c}
              onClick={() => setCommand(c)}
              style={{
                padding: '2px 6px', fontSize: 10, cursor: 'pointer',
                background: 'var(--bg-secondary)', color: 'var(--accent-blue)',
                borderRadius: 3, border: '1px solid var(--border-color)',
                fontFamily: 'ui-monospace, monospace'
              }}
            >
              {c}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Button size="mini" onClick={clearHistory} disabled={history.length === 0}>清空</Button>
          <div style={{ flex: 1 }} />
          <span
            onClick={() => setFontSize(Math.max(7, fontSize - 1))}
            style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer',
              background: 'var(--bg-secondary)', borderRadius: 3, border: '1px solid var(--border-color)' }}
          >A-</span>
          <span
            onClick={() => setFontSize(Math.min(20, fontSize + 1))}
            style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer',
              background: 'var(--bg-secondary)', borderRadius: 3, border: '1px solid var(--border-color)' }}
          >A+</span>
        </div>
      </div>

      {/* 输出历史 */}
      <div style={{
        background: '#0F1A2E',
        color: '#E2E8F0',
        borderRadius: 8,
        padding: 10,
        fontSize,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        maxHeight: '60vh',
        overflowY: 'auto',
        minHeight: 200
      }}>
        {history.length === 0 ? (
          <div style={{ color: '#64748B', textAlign: 'center', padding: 20 }}>
            输入命令后回车执行，如: ls -la /tmp
          </div>
        ) : (
          [...history].reverse().map((h, i) => (
            <div key={i} style={{ marginBottom: 12, borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: 8 }}>
              <div style={{ color: '#94A3B8', fontSize: fontSize - 1, marginBottom: 2 }}>
                [{h.time}]
              </div>
              <div style={{ color: '#60A5FA', marginBottom: 4 }}>
                $ {h.cmd}
              </div>
              {h.stdout && (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#E2E8F0' }}>
                  {h.stdout}
                </div>
              )}
              {h.stderr && (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#FBBF24' }}>
                  {h.stderr}
                </div>
              )}
              {h.error && (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#F87171' }}>
                  ❌ {h.error}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

