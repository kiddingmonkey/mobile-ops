import { useEffect, useState } from 'react'
import { List, Tabs, PullToRefresh, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { RightOutline } from 'antd-mobile-icons'
import { api } from '@/api/client'
import PageShell from '@/components/PageShell'

type ResourceType = 'pods' | 'deployments' | 'services' | 'configmaps' | 'secrets' | 'statefulsets' | 'daemonsets' | 'ingresses' | 'nodes'

const TABS: { key: ResourceType; label: string }[] = [
  { key: 'pods', label: 'Pods' },
  { key: 'deployments', label: 'Deployments' },
  { key: 'statefulsets', label: 'StatefulSets' },
  { key: 'daemonsets', label: 'DaemonSets' },
  { key: 'services', label: 'Services' },
  { key: 'ingresses', label: 'Ingresses' },
  { key: 'configmaps', label: 'ConfigMaps' },
  { key: 'secrets', label: 'Secrets' },
  { key: 'nodes', label: 'Nodes' }
]

export default function ClusterResourcesPage() {
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const clusterId = parseInt(id || '0')
  const [cluster, setCluster] = useState<any>(null)
  const [tab, setTab] = useState<ResourceType>('pods')
  const [resources, setResources] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (clusterId) {
      api.getCluster(clusterId).then(setCluster).catch(() => {})
      loadResources(tab)
    }
  }, [clusterId, tab])

  const loadResources = async (type: ResourceType) => {
    setLoading(true)
    try {
      const data = await api.get(`/clusters/${clusterId}/resources/${type}`)
      setResources(data || [])
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '加载失败', icon: 'fail' })
      setResources([])
    } finally {
      setLoading(false)
    }
  }

  const openDetail = (r: any) => {
    if (tab === 'pods') {
      nav(`/clusters/${clusterId}/pods/${r.namespace}/${r.name}`)
      return
    }
    if (tab === 'nodes') {
      nav(`/clusters/${clusterId}/resources/nodes/-/${r.name}`)
      return
    }
    // 其他资源统一进ResourceDetail
    nav(`/clusters/${clusterId}/resources/${tab}/${r.namespace}/${r.name}`)
  }

  return (
    <PageShell title={cluster?.display_name || '集群资源'} onBack={() => nav(-1)}>
      <Tabs activeKey={tab} onChange={k => setTab(k as ResourceType)} style={{
        '--title-font-size': '12px',
        '--active-title-color': 'var(--accent-blue)'
      } as any}>
        {TABS.map(t => <Tabs.Tab title={t.label} key={t.key} />)}
      </Tabs>

      <PullToRefresh onRefresh={() => loadResources(tab)}>
        <div className="page-content">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>加载中...</div>
          ) : resources.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">没有 {tab}</div>
            </div>
          ) : (
            <List mode="card" style={{
              '--font-size': '12px',
              '--prefix-width': '0px'
            } as any}>
              {resources.map((r, i) => {
                const { description, statusColor } = getRowInfo(tab, r)

                return (
                  <List.Item
                    key={i}
                    prefix={
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: statusColor,
                        marginRight: 6
                      }} />
                    }
                    description={
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {description}
                      </div>
                    }
                    arrow={<RightOutline fontSize={14} />}
                    style={{
                      padding: '8px 12px',
                      fontSize: 13
                    }}
                    onClick={() => openDetail(r)}
                  >
                    {r.name}
                  </List.Item>
                )
              })}
            </List>
          )}
        </div>
      </PullToRefresh>
    </PageShell>
  )
}

function getRowInfo(tab: ResourceType, r: any): { description: string; statusColor: string } {
  switch (tab) {
    case 'pods':
      return {
        description: `${r.namespace} · ${r.ready} · Restarts: ${r.restarts || 0}`,
        statusColor: r.status === 'Running' ? 'var(--success)' : 'var(--warning)'
      }
    case 'deployments':
      return {
        description: `${r.namespace} · ${r.ready} · Available: ${r.available}`,
        statusColor: r.available > 0 ? 'var(--success)' : 'var(--warning)'
      }
    case 'statefulsets':
      return {
        description: `${r.namespace} · ${r.ready}/${r.replicas}`,
        statusColor: r.ready === r.replicas ? 'var(--success)' : 'var(--warning)'
      }
    case 'daemonsets':
      return {
        description: `${r.namespace} · Ready ${r.ready}/${r.desired}`,
        statusColor: r.ready === r.desired ? 'var(--success)' : 'var(--warning)'
      }
    case 'services':
      return {
        description: `${r.namespace} · ${r.type} · ${r.cluster_ip}`,
        statusColor: 'var(--accent-blue)'
      }
    case 'ingresses':
      return {
        description: `${r.namespace} · ${(r.hosts || []).slice(0, 2).join(', ') || '-'}`,
        statusColor: 'var(--accent-blue)'
      }
    case 'configmaps':
      return {
        description: `${r.namespace} · Keys: ${r.data_count}`,
        statusColor: 'var(--accent-blue)'
      }
    case 'secrets':
      return {
        description: `${r.namespace} · ${r.type} · Keys: ${r.data_count}`,
        statusColor: 'var(--warning)'
      }
    case 'nodes':
      return {
        description: `${r.ready === 'True' ? 'Ready' : r.ready} · ${r.zone || '-'}`,
        statusColor: r.ready === 'True' ? 'var(--success)' : 'var(--danger)'
      }
  }
}
