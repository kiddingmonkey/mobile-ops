import { useEffect, useState } from 'react'
import { List, Tabs, PullToRefresh, Card, Tag, Button, Dialog, TextArea, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { RightOutline } from 'antd-mobile-icons'
import { api } from '@/api/client'
import PageShell from '@/components/PageShell'

type ResourceType = 'pods' | 'deployments' | 'services' | 'configmaps' | 'secrets' | 'nodes'

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
      Toast.show({ content: e?.message || '加载失败', icon: 'fail' })
      setResources([])
    } finally {
      setLoading(false)
    }
  }

  const viewYAML = async (resource: any) => {
    try {
      Toast.show({ content: '加载中...', icon: 'loading', duration: 0 })
      const yaml = await api.get(`/clusters/${clusterId}/resources/${tab}/yaml`, {
        params: { namespace: resource.namespace, name: resource.name }
      })
      Toast.clear()

      Dialog.alert({
        title: resource.name,
        content: (
          <div>
            <div style={{ marginBottom: 8 }}>
              <Tag color="primary" style={{ marginRight: 4 }}>{resource.namespace}</Tag>
              <Tag color={resource.status === 'Running' ? 'success' : 'warning'}>{resource.status}</Tag>
            </div>
            <pre style={{
              fontSize: 11,
              overflow: 'auto',
              maxHeight: '60vh',
              background: '#1E293B',
              color: '#F8FAFC',
              padding: 12,
              borderRadius: 8
            }}>{JSON.stringify(yaml, null, 2)}</pre>
          </div>
        ),
        closeOnMaskClick: true
      })
    } catch (e: any) {
      Toast.show({ content: e?.message || '加载失败', icon: 'fail' })
    }
  }

  return (
    <PageShell title={cluster?.display_name || '集群资源'} onBack={() => nav(-1)}>
      <Tabs activeKey={tab} onChange={k => setTab(k as ResourceType)} style={{
        '--title-font-size': '13px',
        '--active-title-color': 'var(--accent-blue)'
      } as any}>
        <Tabs.Tab title="Pods" key="pods" />
        <Tabs.Tab title="Deployments" key="deployments" />
        <Tabs.Tab title="Services" key="services" />
        <Tabs.Tab title="ConfigMaps" key="configmaps" />
        <Tabs.Tab title="Nodes" key="nodes" />
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
            <List mode="card">
              {resources.map((r, i) => {
                let description = ''
                let statusColor = 'var(--success)'

                switch (tab) {
                  case 'pods':
                    description = `Namespace: ${r.namespace} · Ready: ${r.ready} · Restarts: ${r.restarts || 0}`
                    statusColor = r.status === 'Running' ? 'var(--success)' : 'var(--warning)'
                    break
                  case 'deployments':
                    description = `Namespace: ${r.namespace} · Ready: ${r.ready} · Available: ${r.available}`
                    statusColor = r.available > 0 ? 'var(--success)' : 'var(--warning)'
                    break
                  case 'services':
                    description = `Namespace: ${r.namespace} · Type: ${r.type} · ClusterIP: ${r.cluster_ip}`
                    statusColor = 'var(--accent-blue)'
                    break
                  case 'configmaps':
                    description = `Namespace: ${r.namespace} · Keys: ${r.data_count}`
                    statusColor = 'var(--accent-blue)'
                    break
                  case 'secrets':
                    description = `Namespace: ${r.namespace} · Type: ${r.type} · Keys: ${r.data_count}`
                    statusColor = 'var(--warning)'
                    break
                  case 'nodes':
                    description = `Status: ${r.status || 'Ready'} · Version: ${r.version || 'N/A'}`
                    statusColor = 'var(--success)'
                    break
                }

                return (
                  <List.Item
                    key={i}
                    prefix={<div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: statusColor
                    }}/>}
                    description={description}
                    extra={<span className="text-xs">{r.status || r.type || 'OK'}</span>}
                    arrow={<RightOutline />}
                    onClick={() => viewYAML(r)}
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
