import { useEffect, useMemo, useState } from 'react'
import { List, Tabs, PullToRefresh, Toast, SearchBar, Popover } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { RightOutline, UnorderedListOutline, FilterOutline } from 'antd-mobile-icons'
import { api, API_BASE } from '@/api/client'
import { useEventStream } from '@/hooks/useEventStream'
import PageShell from '@/components/PageShell'

type ResourceType = string // 内置类型 + 动态 CRD 类型（格式：crd::group/version/resource）

const BUILTIN_TABS: { key: string; label: string }[] = [
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

type SortKey = 'name' | 'age' | 'status'

export default function ClusterResourcesPage() {
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const clusterId = parseInt(id || '0')
  const [cluster, setCluster] = useState<any>(null)
  const [tab, setTab] = useState<ResourceType>('pods')
  const [resources, setResources] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 搜索/排序/过滤 状态
  const [keyword, setKeyword] = useState('')
  const [namespace, setNamespace] = useState<string>('')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDesc, setSortDesc] = useState(false)

  // CRD 动态 Tab
  const [crds, setCrds] = useState<{ key: string; label: string; namespaced: boolean }[]>([])
  const [showCrds, setShowCrds] = useState(false)

  // SSE实时更新 (仅内置资源支持，CRD 走轮询)
  const isBuiltin = BUILTIN_TABS.some(t => t.key === tab)
  const sseUrl = clusterId && tab && isBuiltin
    ? `${API_BASE}/clusters/${clusterId}/resources/${tab}/watch${namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''}`
    : ''

  const { connected } = useEventStream({
    url: sseUrl,
    enabled: !!sseUrl && resources.length > 0, // 只有加载完初始数据后才启用SSE
    onMessage: (events) => {
      events.forEach((evt: any) => {
        const { type, object } = evt
        if (!object || !object.name) return

        setResources(prev => {
          const idx = prev.findIndex(r => r.name === object.name && r.namespace === object.namespace)

          if (type === 'DELETED') {
            // 删除
            return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev
          }

          if (type === 'ADDED') {
            // 新增（避免重复）
            if (idx >= 0) return prev
            const newItem = transformResource(tab, object)
            return [...prev, newItem]
          }

          if (type === 'MODIFIED' && idx >= 0) {
            // 更新
            const updated = [...prev]
            updated[idx] = transformResource(tab, object)
            return updated
          }

          return prev
        })
      })
    }
  })

  useEffect(() => {
    if (clusterId) {
      api.getCluster(clusterId).then(setCluster).catch(() => {})
      api.listNamespaces(clusterId).then(ns => setNamespaces(ns || [])).catch(() => {})
      api.get(`/clusters/${clusterId}/crds`).then((r: any) => {
        setCrds((r || []).map((c: any) => ({
          key: `crd::${c.group}/${c.version}/${c.plural}`,
          label: c.kind,
          namespaced: c.namespaced
        })))
      }).catch(() => {})
    }
  }, [clusterId])

  useEffect(() => {
    if (clusterId) loadResources(tab)
  }, [clusterId, tab, namespace])

  const loadResources = async (type: ResourceType) => {
    setLoading(true)
    try {
      let data: any
      if (type.startsWith('crd::')) {
        const gvr = type.slice(5) // group/version/resource
        const parts = gvr.split('/')
        data = await api.get(`/clusters/${clusterId}/crds/${parts[0]}/${parts[1]}/${parts[2]}`, {
          params: namespace ? { namespace } : {}
        })
      } else {
        data = await api.get(`/clusters/${clusterId}/resources/${type}`, {
          params: namespace ? { namespace } : {}
        })
      }
      setResources(data || [])
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '加载失败', icon: 'fail' })
      setResources([])
    } finally {
      setLoading(false)
    }
  }

  const filteredSorted = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const list = kw
      ? resources.filter(r => (r.name || '').toLowerCase().includes(kw))
      : resources
    const sorted = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.name || '').localeCompare(b.name || '')
      else if (sortKey === 'age') cmp = new Date(a.age || 0).getTime() - new Date(b.age || 0).getTime()
      else if (sortKey === 'status') cmp = (a.status || a.ready || '').toString().localeCompare((b.status || b.ready || '').toString())
      return sortDesc ? -cmp : cmp
    })
    return sorted
  }, [resources, keyword, sortKey, sortDesc])

  const openDetail = (r: any) => {
    if (tab === 'pods') {
      nav(`/clusters/${clusterId}/pods/${r.namespace}/${r.name}`)
      return
    }
    if (tab === 'nodes') {
      nav(`/clusters/${clusterId}/resources/nodes/-/${r.name}`)
      return
    }
    if (tab.startsWith('crd::')) {
      const gvr = tab.slice(5)
      nav(`/clusters/${clusterId}/crds/${encodeURIComponent(gvr)}/${r.namespace || '-'}/${r.name}`)
      return
    }
    nav(`/clusters/${clusterId}/resources/${tab}/${r.namespace}/${r.name}`)
  }

  const allTabs = useMemo(() => {
    return showCrds && crds.length > 0
      ? [...BUILTIN_TABS, ...crds.map(c => ({ key: c.key, label: c.label }))]
      : BUILTIN_TABS
  }, [showCrds, crds])

  const sortActions = [
    { key: 'name-asc', text: '名称 ↑' },
    { key: 'name-desc', text: '名称 ↓' },
    { key: 'age-asc', text: '创建时间 ↑' },
    { key: 'age-desc', text: '创建时间 ↓' },
    { key: 'status-asc', text: '状态 ↑' },
    { key: 'status-desc', text: '状态 ↓' }
  ]

  return (
    <PageShell title={cluster?.display_name || '集群资源'} onBack={() => nav(-1)}>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Tabs activeKey={tab} onChange={k => setTab(k)} style={{
            '--title-font-size': '12px',
            '--active-title-color': 'var(--accent-blue)'
          } as any}>
            {allTabs.map(t => <Tabs.Tab title={t.label} key={t.key} />)}
          </Tabs>
        </div>
        {crds.length > 0 && (
          <div
            onClick={() => setShowCrds(v => !v)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              color: showCrds ? 'var(--accent-blue)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {showCrds ? 'CRD ✓' : `+CRD(${crds.length})`}
          </div>
        )}
      </div>

      {/* 搜索 / 命名空间过滤 / 排序 */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '8px 12px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1 }}>
          <SearchBar
            placeholder="搜索名称"
            value={keyword}
            onChange={setKeyword}
            style={{ '--height': '32px', '--font-size': '12px' } as any}
          />
        </div>
        <Popover.Menu
          actions={[
            { key: '', text: '全部命名空间' },
            ...namespaces.map(ns => ({ key: ns, text: ns }))
          ]}
          onAction={(node: any) => setNamespace(node.key)}
          trigger="click"
          placement="bottom-end"
        >
          <div style={{
            padding: '6px 8px',
            fontSize: 11,
            borderRadius: 4,
            background: namespace ? 'var(--accent-blue)' : 'var(--bg-secondary)',
            color: namespace ? '#fff' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            maxWidth: 100,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'pointer'
          }}>
            <FilterOutline fontSize={12} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{namespace || 'ns'}</span>
          </div>
        </Popover.Menu>
        <Popover.Menu
          actions={sortActions}
          onAction={(node: any) => {
            const [k, dir] = node.key.split('-')
            setSortKey(k as SortKey)
            setSortDesc(dir === 'desc')
          }}
          trigger="click"
          placement="bottom-end"
        >
          <div style={{
            padding: '6px 8px',
            fontSize: 11,
            borderRadius: 4,
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            cursor: 'pointer'
          }}>
            <UnorderedListOutline fontSize={12} />
            <span>{sortKey}{sortDesc ? '↓' : '↑'}</span>
          </div>
        </Popover.Menu>
      </div>

      <PullToRefresh onRefresh={() => loadResources(tab)}>
        <div className="page-content">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>加载中...</div>
          ) : filteredSorted.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">{keyword ? '没有匹配' : `没有 ${tab}`}</div>
            </div>
          ) : (
            <List mode="card" style={{
              '--font-size': '12px',
              '--prefix-width': '0px'
            } as any}>
              {filteredSorted.map((r, i) => {
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
  if (tab.startsWith('crd::')) {
    return {
      description: `${r.namespace || '-'} · ${r.age ? new Date(r.age).toLocaleDateString() : ''}`,
      statusColor: 'var(--accent-blue)'
    }
  }
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
    default:
      return {
        description: `${r.namespace || '-'}`,
        statusColor: 'var(--accent-blue)'
      }
  }
}

// 将K8s原始对象转换为列表项格式
function transformResource(type: ResourceType, obj: any): any {
  const metadata = obj.metadata || {}
  const status = obj.status || {}
  const spec = obj.spec || {}

  if (type.startsWith('crd::')) {
    return { name: metadata.name, namespace: metadata.namespace, age: metadata.creationTimestamp }
  }

  switch (type) {
    case 'pods':
      const containerStatuses = status.containerStatuses || []
      const ready = containerStatuses.filter((c: any) => c.ready).length
      const total = containerStatuses.length
      const restarts = containerStatuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0)
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        status: status.phase || 'Unknown',
        ready: `${ready}/${total}`,
        restarts,
        age: metadata.creationTimestamp
      }
    case 'deployments':
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        ready: `${status.readyReplicas || 0}/${spec.replicas || 0}`,
        available: status.availableReplicas || 0,
        age: metadata.creationTimestamp
      }
    case 'statefulsets':
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        ready: status.readyReplicas || 0,
        replicas: spec.replicas || 0,
        age: metadata.creationTimestamp
      }
    case 'daemonsets':
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        ready: status.numberReady || 0,
        desired: status.desiredNumberScheduled || 0,
        age: metadata.creationTimestamp
      }
    case 'services':
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        type: spec.type || 'ClusterIP',
        cluster_ip: spec.clusterIP || '',
        age: metadata.creationTimestamp
      }
    case 'nodes':
      const conditions = status.conditions || []
      const readyCond = conditions.find((c: any) => c.type === 'Ready')
      return {
        name: metadata.name,
        ready: readyCond?.status === 'True' ? 'Ready' : 'NotReady',
        age: metadata.creationTimestamp
      }
    default:
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        age: metadata.creationTimestamp
      }
  }
}
