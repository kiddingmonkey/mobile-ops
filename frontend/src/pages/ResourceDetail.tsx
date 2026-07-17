import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Tabs, Tag, Toast, PullToRefresh, Button } from 'antd-mobile'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'
import { shareLog, downloadLog, makeLogFilename } from '@/utils/logShare'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// K8s资源类型 → 中文名 + 是否有namespace
const RESOURCE_META: Record<string, { label: string; namespaced: boolean; kind: string }> = {
  pods:         { label: 'Pod',         namespaced: true,  kind: 'Pod' },
  deployments:  { label: 'Deployment',  namespaced: true,  kind: 'Deployment' },
  services:     { label: 'Service',     namespaced: true,  kind: 'Service' },
  configmaps:   { label: 'ConfigMap',   namespaced: true,  kind: 'ConfigMap' },
  secrets:      { label: 'Secret',      namespaced: true,  kind: 'Secret' },
  statefulsets: { label: 'StatefulSet', namespaced: true,  kind: 'StatefulSet' },
  daemonsets:   { label: 'DaemonSet',   namespaced: true,  kind: 'DaemonSet' },
  ingresses:    { label: 'Ingress',     namespaced: true,  kind: 'Ingress' },
  nodes:        { label: 'Node',        namespaced: false, kind: 'Node' }
}

export default function ResourceDetailPage() {
  const nav = useNavigate()
  const { clusterId, resourceType, namespace, name } = useParams<{
    clusterId: string
    resourceType: string
    namespace: string
    name: string
  }>()
  const cid = Number(clusterId)
  const [tab, setTab] = useState('info')
  const [yaml, setYaml] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const meta = RESOURCE_META[resourceType || ''] || { label: resourceType, namespaced: true, kind: '' }

  const loadYaml = async () => {
    setLoading(true)
    try {
      const params: any = { name }
      if (meta.namespaced) params.namespace = namespace
      const r = await api.get(`/clusters/${cid}/resources/${resourceType}/yaml`, { params })
      setYaml(r)
    } catch (e: any) {
      Toast.show({ content: '加载失败: ' + (e?.response?.data?.error || e?.message), icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const params: any = { name }
      if (meta.namespaced) params.namespace = namespace
      const r = await api.get(`/clusters/${cid}/resources/${resourceType}/events`, { params })
      setEvents(Array.isArray(r) ? r : [])
    } catch (e: any) {
      Toast.show({ content: '加载事件失败', icon: 'fail' })
    }
  }

  useEffect(() => {
    loadYaml()
  }, [clusterId, resourceType, namespace, name])

  useEffect(() => {
    if (tab === 'events') loadEvents()
  }, [tab])

  const downloadYaml = async () => {
    if (!yaml) return
    const content = JSON.stringify(yaml, null, 2)
    const filename = makeLogFilename(`${meta.kind}_${name}`).replace('.log', '.yaml')
    const r = await downloadLog(content, filename)
    Toast.show({ content: r ? '已下载' : '下载失败', icon: r ? 'success' : 'fail' })
  }

  const shareYaml = async () => {
    if (!yaml) return
    const content = JSON.stringify(yaml, null, 2)
    const filename = makeLogFilename(`${meta.kind}_${name}`).replace('.log', '.yaml')
    try {
      await shareLog({ content, filename, title: `${meta.label} - ${name}` })
    } catch {
      Toast.show({ content: '分享失败', icon: 'fail' })
    }
  }

  const spec = yaml?.spec || {}
  const status = yaml?.status || {}

  return (
    <PageShell title={`${meta.label} - ${name}`} onBack={() => nav(-1)}>
      <PullToRefresh onRefresh={loadYaml}>
        <Tabs activeKey={tab} onChange={setTab} style={{ '--title-font-size': '13px' } as any}>
          <Tabs.Tab title="基础信息" key="info">
            <div style={{ padding: 12, paddingBottom: 60 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>加载中...</div>
              ) : yaml ? (
                <>
                  <Section title="元信息">
                    <InfoRow label="Kind" value={yaml.kind || meta.kind} />
                    <InfoRow label="Name" value={yaml.metadata?.name || name || ''} />
                    {meta.namespaced && <InfoRow label="Namespace" value={yaml.metadata?.namespace || namespace || ''} />}
                    {yaml.metadata?.creationTimestamp && (
                      <InfoRow label="创建时间" value={dayjs(yaml.metadata.creationTimestamp).format('YYYY-MM-DD HH:mm:ss') + ' (' + dayjs(yaml.metadata.creationTimestamp).fromNow() + ')'} />
                    )}
                    {yaml.metadata?.uid && <InfoRow label="UID" value={String(yaml.metadata.uid).slice(0, 20) + '...'} />}
                  </Section>

                  {/* Labels */}
                  {yaml.metadata?.labels && Object.keys(yaml.metadata.labels).length > 0 && (
                    <Section title="Labels">
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Object.entries(yaml.metadata.labels).map(([k, v]: [string, any]) => (
                          <Tag key={k} color="primary" style={{ fontSize: 10 }}>
                            {k}={String(v)}
                          </Tag>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Annotations */}
                  {yaml.metadata?.annotations && Object.keys(yaml.metadata.annotations).length > 0 && (
                    <Section title="Annotations">
                      {Object.entries(yaml.metadata.annotations).map(([k, v]: [string, any]) => (
                        <InfoRow key={k} label={k} value={String(v)} />
                      ))}
                    </Section>
                  )}

                  {/* Deployment / StatefulSet 特有 */}
                  {(resourceType === 'deployments' || resourceType === 'statefulsets') && (
                    <Section title="Spec">
                      <InfoRow label="Replicas" value={String(spec.replicas || 0)} />
                      {status.readyReplicas !== undefined && <InfoRow label="Ready" value={String(status.readyReplicas || 0)} />}
                      {status.availableReplicas !== undefined && <InfoRow label="Available" value={String(status.availableReplicas || 0)} />}
                      {status.updatedReplicas !== undefined && <InfoRow label="Updated" value={String(status.updatedReplicas || 0)} />}
                      {spec.strategy?.type && <InfoRow label="Strategy" value={spec.strategy.type} />}
                      {spec.template?.spec?.containers?.[0]?.image && (
                        <InfoRow label="Image" value={spec.template.spec.containers[0].image} />
                      )}
                      {spec.template?.spec?.nodeSelector && Object.keys(spec.template.spec.nodeSelector).length > 0 && (
                        <InfoRow label="NodeSelector" value={JSON.stringify(spec.template.spec.nodeSelector)} />
                      )}
                    </Section>
                  )}

                  {/* Service 特有 */}
                  {resourceType === 'services' && (
                    <Section title="Spec">
                      <InfoRow label="Type" value={spec.type || 'ClusterIP'} />
                      <InfoRow label="ClusterIP" value={spec.clusterIP || '-'} />
                      {spec.externalIPs?.length > 0 && <InfoRow label="ExternalIP" value={spec.externalIPs.join(', ')} />}
                      {spec.ports && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Ports:</div>
                          {spec.ports.map((p: any, i: number) => (
                            <div key={i} style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--text-primary)' }}>
                              {p.name || 'port'} - {p.port}:{p.targetPort}/{p.protocol || 'TCP'}
                            </div>
                          ))}
                        </div>
                      )}
                      {spec.selector && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Selector:</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {Object.entries(spec.selector).map(([k, v]: [string, any]) => (
                              <Tag key={k} color="primary" style={{ fontSize: 10 }}>{k}={String(v)}</Tag>
                            ))}
                          </div>
                        </div>
                      )}
                    </Section>
                  )}

                  {/* ConfigMap */}
                  {resourceType === 'configmaps' && yaml.data && (
                    <Section title={`Data (${Object.keys(yaml.data).length} keys)`}>
                      {Object.entries(yaml.data).map(([k, v]: [string, any]) => (
                        <details key={k} style={{ marginBottom: 8 }}>
                          <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)', cursor: 'pointer' }}>
                            {k}
                          </summary>
                          <pre style={{
                            fontSize: 10,
                            padding: 8,
                            marginTop: 4,
                            background: '#1E293B',
                            color: '#E2E8F0',
                            borderRadius: 4,
                            overflowX: 'auto',
                            maxHeight: 240,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                          }}>{String(v)}</pre>
                        </details>
                      ))}
                    </Section>
                  )}

                  {/* Ingress */}
                  {resourceType === 'ingresses' && (
                    <Section title="Rules">
                      {spec.rules?.map((r: any, i: number) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>Host: {r.host || '*'}</div>
                          {r.http?.paths?.map((p: any, j: number) => (
                            <div key={j} style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 12 }}>
                              {p.pathType || 'Prefix'} {p.path} → {p.backend?.service?.name}:{p.backend?.service?.port?.number || p.backend?.service?.port?.name}
                            </div>
                          ))}
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Node */}
                  {resourceType === 'nodes' && (
                    <Section title="Info">
                      {status.nodeInfo && (
                        <>
                          <InfoRow label="OS" value={status.nodeInfo.operatingSystem + ' / ' + status.nodeInfo.osImage} />
                          <InfoRow label="Kernel" value={status.nodeInfo.kernelVersion} />
                          <InfoRow label="Runtime" value={status.nodeInfo.containerRuntimeVersion} />
                          <InfoRow label="Kubelet" value={status.nodeInfo.kubeletVersion} />
                          <InfoRow label="Arch" value={status.nodeInfo.architecture} />
                        </>
                      )}
                      {status.capacity && (
                        <>
                          <InfoRow label="CPU" value={String(status.capacity.cpu)} />
                          <InfoRow label="Memory" value={String(status.capacity.memory)} />
                          <InfoRow label="Pods" value={String(status.capacity.pods)} />
                        </>
                      )}
                    </Section>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>无数据</div>
              )}
            </div>
          </Tabs.Tab>

          <Tabs.Tab title="事件" key="events">
            <div style={{ padding: 12, paddingBottom: 60 }}>
              {events.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>暂无事件</div>
              ) : (
                events.map((e: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--bg-elevated)',
                      borderLeft: `3px solid ${e.type === 'Warning' ? 'var(--danger)' : 'var(--success)'}`,
                      padding: 10,
                      marginBottom: 8,
                      borderRadius: 6
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <Tag color={e.type === 'Warning' ? 'danger' : 'success'} style={{ fontSize: 10 }}>{e.type}</Tag>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.reason}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{e.message}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 8 }}>
                      <span>{e.last_at && dayjs(e.last_at).fromNow()}</span>
                      {e.count > 1 && <span>× {e.count}</span>}
                      {e.component && <span>{e.component}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Tabs.Tab>

          <Tabs.Tab title="YAML" key="yaml">
            <div style={{ padding: 12, paddingBottom: 60 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <Button size="mini" onClick={downloadYaml} disabled={!yaml}>📥 下载</Button>
                <Button size="mini" color="primary" fill="outline" onClick={shareYaml} disabled={!yaml}>📤 分享</Button>
              </div>
              <pre style={{
                fontSize: 10,
                fontFamily: 'ui-monospace, monospace',
                background: '#1E293B',
                color: '#E2E8F0',
                padding: 10,
                borderRadius: 6,
                overflow: 'auto',
                maxHeight: '70vh',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                margin: 0
              }}>{yaml ? JSON.stringify(yaml, null, 2) : '加载中...'}</pre>
            </div>
          </Tabs.Tab>
        </Tabs>
      </PullToRefresh>
    </PageShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{title}</div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', marginBottom: 6, fontSize: 12 }}>
      <span style={{ color: 'var(--text-tertiary)', minWidth: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', flex: 1, wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}
