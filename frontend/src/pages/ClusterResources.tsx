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
      // 这里调用后端 API 拉 K8s 资源列表
      // 暂时用 mock 数据演示
      await new Promise(resolve => setTimeout(resolve, 500))
      setResources([
        { name: 'nginx-deployment', namespace: 'default', status: 'Running', ready: '3/3' },
        { name: 'redis-service', namespace: 'default', status: 'Running', ready: '1/1' }
      ])
    } catch (e: any) {
      Toast.show({ content: e?.message || '加载失败', icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  const viewYAML = async (name: string) => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx:latest`

    Dialog.alert({
      title: name,
      content: <pre style={{ fontSize: 11, overflow: 'auto', maxHeight: '60vh' }}>{yaml}</pre>
    })
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
              {resources.map((r, i) => (
                <List.Item
                  key={i}
                  prefix={<div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: r.status === 'Running' ? 'var(--success)' : 'var(--warning)'
                  }}/>}
                  description={`Namespace: ${r.namespace} · Ready: ${r.ready}`}
                  extra={<span className="text-xs">{r.status}</span>}
                  arrow={<RightOutline />}
                  onClick={() => viewYAML(r.name)}
                >
                  {r.name}
                </List.Item>
              ))}
            </List>
          )}
        </div>
      </PullToRefresh>
    </PageShell>
  )
}
