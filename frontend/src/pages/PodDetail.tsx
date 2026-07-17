import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Tabs, Card, Tag, List, Toast, PullToRefresh, Button } from 'antd-mobile'
import { ClockCircleOutline, CheckCircleOutline, CloseCircleOutline } from 'antd-mobile-icons'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'
import { shareLog, downloadLog, makeLogFilename } from '@/utils/logShare'
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

  return (
    <PageShell title={name || 'Pod'} onBack={() => nav(-1)}>
      <PullToRefresh onRefresh={refresh}>
        <div style={{ background: 'var(--background)', minHeight: '100vh' }}>
          <Tabs activeKey={tab} onChange={setTab} style={{ '--title-font-size': '14px' }}>
            <Tabs.Tab title="详情" key="detail">
              <DetailTab detail={detail} />
            </Tabs.Tab>
            <Tabs.Tab title="容器" key="containers">
              <ContainersTab detail={detail} onSelectLog={loadLogs} />
            </Tabs.Tab>
            <Tabs.Tab title="事件" key="events">
              <EventsTab events={events} />
            </Tabs.Tab>
            <Tabs.Tab title="日志" key="logs">
              <LogsTab
                logs={logs}
                containers={detail.containers}
                podName={name || ''}
                onLoad={loadLogs}
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
          <Button block color="primary" size="small" onClick={doLoad}>
            加载日志
          </Button>
          <Button size="small" onClick={doDownload} disabled={!logs}>
            📥 下载
          </Button>
          <Button size="small" color="primary" fill="outline" onClick={doShare} disabled={!logs}>
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
        {logs || '点击"加载日志"按钮查看容器日志'}
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
