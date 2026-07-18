import { useEffect, useMemo, useState, useCallback } from 'react'
import { PullToRefresh, Toast, SearchBar, SpinLoading } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { api, API_BASE } from '@/api/client'
import { useEventStream } from '@/hooks/useEventStream'
import PageShell from '@/components/PageShell'
import { hapticLight } from '@/utils/haptics'
import QuickActionsSheet from '@/components/QuickActionsSheet'

type ResourceType = string

const BUILTIN: { key: string; label: string; icon: string }[] = [
  { key: 'pods',         label: 'Pods',         icon: '📦' },
  { key: 'deployments',  label: 'Deploys',       icon: '🚀' },
  { key: 'statefulsets', label: 'StatefulSets',  icon: '💾' },
  { key: 'daemonsets',   label: 'DaemonSets',    icon: '👾' },
  { key: 'services',     label: 'Services',      icon: '🌐' },
  { key: 'ingresses',    label: 'Ingresses',     icon: '🔀' },
  { key: 'configmaps',   label: 'ConfigMaps',    icon: '⚙️' },
  { key: 'secrets',      label: 'Secrets',       icon: '🔐' },
  { key: 'nodes',        label: 'Nodes',         icon: '🖥️' }
]

export default function ClusterResourcesPage() {
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const clusterId = parseInt(id || '0')
  const [cluster, setCluster]   = useState<any>(null)
  const [tab, setTab]           = useState<ResourceType>('pods')
  const [resources, setResources] = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [keyword, setKeyword]   = useState('')
  const [namespace, setNamespace] = useState<string>('')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [crds, setCrds]         = useState<any[]>([])
  const [crdSearch, setCrdSearch] = useState('')
  const [showCrds, setShowCrds] = useState(false)
  const [actionsResource, setActionsResource] = useState<any>(null)

  const isBuiltin = BUILTIN.some(t => t.key === tab)

  // SSE 实时更新（只有内置资源支持）
  const sseUrl = clusterId && isBuiltin
    ? `${API_BASE}/clusters/${clusterId}/resources/${tab}/watch${namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''}`
    : ''
  const { connected } = useEventStream({
    url: sseUrl,
    enabled: !!sseUrl && resources.length > 0,
    onMessage: (events) => {
      events.forEach((evt: any) => {
        const { type, object } = evt
        if (!object?.name) return
        setResources(prev => {
          const idx = prev.findIndex(r => r.name === object.name && r.namespace === object.namespace)
          if (type === 'DELETED') return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev
          if (type === 'ADDED')   return idx >= 0 ? prev : [...prev, transformResource(tab, object)]
          if (type === 'MODIFIED' && idx >= 0) {
            const u = [...prev]; u[idx] = transformResource(tab, object); return u
          }
          return prev
        })
      })
    }
  })

  useEffect(() => {
    if (!clusterId) return
    api.getCluster(clusterId).then(setCluster).catch(() => {})
    api.listNamespaces(clusterId).then(ns => setNamespaces(ns || [])).catch(() => {})
    api.get(`/clusters/${clusterId}/crds`).then((r: any) => {
      setCrds(r || [])
    }).catch(() => {})
  }, [clusterId])

  const loadResources = useCallback(async (type: ResourceType) => {
    setLoading(true)
    setKeyword('')
    try {
      let data: any
      if (type.startsWith('crd::')) {
        const [g, v, res] = type.slice(5).split('/')
        data = await api.get(`/clusters/${clusterId}/crds/${g}/${v}/${res}`, {
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
    } finally { setLoading(false) }
  }, [clusterId, namespace])

  useEffect(() => { loadResources(tab) }, [tab, namespace])

  const filtered = useMemo(() => {
    if (!keyword) return resources
    const kw = keyword.toLowerCase()
    return resources.filter(r =>
      (r.name || '').toLowerCase().includes(kw) ||
      (r.namespace || '').toLowerCase().includes(kw)
    )
  }, [resources, keyword])

  // CRD 按 group 分组，支持搜索
  const crdGroups = useMemo(() => {
    const search = crdSearch.toLowerCase()
    const filtered = search
      ? crds.filter(c => c.kind.toLowerCase().includes(search) || c.group.toLowerCase().includes(search))
      : crds
    const groups: Record<string, any[]> = {}
    filtered.forEach(c => {
      const g = c.group || '其他'
      if (!groups[g]) groups[g] = []
      groups[g].push(c)
    })
    return groups
  }, [crds, crdSearch])

  const openDetail = (r: any) => {
    hapticLight()
    if (tab === 'pods')  return nav(`/clusters/${clusterId}/pods/${r.namespace}/${r.name}`)
    if (tab === 'nodes') return nav(`/clusters/${clusterId}/resources/nodes/-/${r.name}`)
    if (tab.startsWith('crd::')) {
      const gvr = tab.slice(5)
      return nav(`/clusters/${clusterId}/crds/${encodeURIComponent(gvr)}/${r.namespace || '-'}/${r.name}`)
    }
    nav(`/clusters/${clusterId}/resources/${tab}/${r.namespace}/${r.name}`)
  }

  const currentBuiltin = BUILTIN.find(b => b.key === tab)
  const currentCrd = !currentBuiltin && tab.startsWith('crd::')
    ? crds.find(c => `crd::${c.group}/${c.version}/${c.plural}` === tab)
    : null
  const currentLabel = currentBuiltin?.label ?? currentCrd?.kind ?? tab

  return (
    <PageShell title={cluster?.display_name || '集群资源'} onBack={() => nav(-1)} flex>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* === 左侧竖向 Tab === */}
        <div style={{
          width: 68,
          flexShrink: 0,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 内置资源 Tab */}
          {BUILTIN.map(b => (
            <div
              key={b.key}
              onClick={() => { hapticLight(); setTab(b.key); setShowCrds(false) }}
              style={{
                padding: '9px 4px',
                textAlign: 'center',
                cursor: 'pointer',
                background: tab === b.key ? 'var(--accent-blue-bg)' : 'transparent',
                borderLeft: tab === b.key ? '3px solid var(--accent-blue)' : '3px solid transparent',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ fontSize: 16 }}>{b.icon}</div>
              <div style={{ fontSize: 9, marginTop: 2, color: tab === b.key ? 'var(--accent-blue)' : 'var(--text-tertiary)', fontWeight: tab === b.key ? 600 : 400, lineHeight: 1.2 }}>
                {b.label.length > 7 ? b.label.slice(0, 6) + '…' : b.label}
              </div>
            </div>
          ))}

          {/* CRD 入口 */}
          {crds.length > 0 && (
            <div
              onClick={() => setShowCrds(v => !v)}
              style={{
                padding: '9px 4px',
                textAlign: 'center',
                cursor: 'pointer',
                background: showCrds || tab.startsWith('crd::') ? 'var(--accent-blue-bg)' : 'transparent',
                borderLeft: showCrds || tab.startsWith('crd::') ? '3px solid var(--accent-blue)' : '3px solid transparent',
                borderTop: '1px solid var(--border-color)',
                marginTop: 4
              }}
            >
              <div style={{ fontSize: 16 }}>🧩</div>
              <div style={{ fontSize: 9, marginTop: 2, color: showCrds || tab.startsWith('crd::') ? 'var(--accent-blue)' : 'var(--text-tertiary)', fontWeight: 600 }}>
                CRD<br/>{crds.length}
              </div>
            </div>
          )}
        </div>

        {/* === 右侧内容区 === */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {showCrds ? (
            /* CRD 选择面板 */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '8px 8px 4px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                <SearchBar
                  placeholder={`搜索 CRD (共 ${crds.length} 个)`}
                  value={crdSearch}
                  onChange={setCrdSearch}
                  style={{ '--height': '28px', '--font-size': '12px' } as any}
                />
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {Object.entries(crdGroups).map(([group, items]) => (
                  <div key={group}>
                    <div style={{ padding: '6px 10px 3px', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', letterSpacing: 0.3 }}>
                      {group}
                    </div>
                    {items.map((c: any) => {
                      const key = `crd::${c.group}/${c.version}/${c.plural}`
                      const isActive = tab === key
                      return (
                        <div
                          key={key}
                          onClick={() => { hapticLight(); setTab(key); setShowCrds(false) }}
                          style={{
                            padding: '9px 10px',
                            fontSize: 12,
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)',
                            background: isActive ? 'var(--accent-blue-bg)' : 'transparent',
                            color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                            fontWeight: isActive ? 600 : 400,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span>🧩 {c.kind}</span>
                          {!c.namespaced && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 4 }}>cluster</span>}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {Object.keys(crdGroups).length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                    没有匹配的 CRD
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 资源列表 */
            <>
              {/* 标题行 + 过滤 */}
              <div style={{ padding: '6px 8px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                  {currentLabel}
                </div>
                {isBuiltin && connected && (
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--success)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SearchBar
                    placeholder="搜索名称..."
                    value={keyword}
                    onChange={setKeyword}
                    style={{ '--height': '26px', '--font-size': '12px' } as any}
                  />
                </div>
                {/* 命名空间过滤 */}
                {namespaces.length > 0 && (
                  <select
                    value={namespace}
                    onChange={e => setNamespace(e.target.value)}
                    style={{
                      padding: '3px 6px',
                      fontSize: 11,
                      background: namespace ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                      color: namespace ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${namespace ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                      borderRadius: 6,
                      maxWidth: 90,
                      flexShrink: 0
                    }}
                  >
                    <option value="">全部 ns</option>
                    {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                  </select>
                )}
              </div>

              {/* 列表 */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <SpinLoading style={{ '--size': '32px' }} />
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 12 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                    {keyword ? '没有匹配的资源' : `没有 ${currentLabel}`}
                  </div>
                ) : (
                  <div>
                    {filtered.map((r, i) => {
                      const { description, statusColor, meta } = getRowInfo(tab, r)
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 8px 6px 10px',
                            borderBottom: '1px solid var(--border-color)',
                            background: 'var(--bg-elevated)',
                            minHeight: 40
                          }}
                        >
                          {/* 状态点 */}
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />

                          {/* 主体 - 点击进详情 */}
                          <div
                            onClick={() => openDetail(r)}
                            style={{ flex: 1, minWidth: 0, cursor: 'pointer', paddingRight: 4 }}
                          >
                            <div style={{
                              fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              lineHeight: 1.3
                            }}>
                              {r.name}
                            </div>
                            <div style={{
                              fontSize: 10, color: 'var(--text-tertiary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              marginTop: 1, lineHeight: 1.2
                            }}>
                              {description}
                            </div>
                          </div>

                          {/* 关键指标（如副本数） */}
                          {meta && (
                            <div style={{
                              fontSize: 10, fontWeight: 600,
                              color: 'var(--text-secondary)',
                              padding: '2px 6px',
                              background: 'var(--bg-secondary)',
                              borderRadius: 4,
                              flexShrink: 0
                            }}>
                              {meta}
                            </div>
                          )}

                          {/* 快捷操作三点按钮 */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              hapticLight()
                              setActionsResource({
                                tab, name: r.name, namespace: r.namespace,
                                clusterId, replicas: r.replicas ?? parseInt(r.ready?.split('/')?.[1] || '0')
                              })
                            }}
                            style={{
                              width: 30, height: 30, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                              fontSize: 18, fontWeight: 700
                            }}
                          >
                            ⋯
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 快捷操作底部弹窗 */}
      <QuickActionsSheet
        visible={!!actionsResource}
        resource={actionsResource}
        onClose={() => setActionsResource(null)}
        onRefresh={() => loadResources(tab)}
      />
    </PageShell>
  )
}

// ---- 工具函数 ----

function getRowInfo(tab: string, r: any): { description: string; statusColor: string; meta?: string } {
  switch (tab) {
    case 'pods':        return { description: `${r.namespace} · 重启 ${r.restarts || 0}`, meta: r.ready, statusColor: r.status === 'Running' ? 'var(--success)' : 'var(--warning)' }
    case 'deployments': return { description: `${r.namespace} · Avail ${r.available}`, meta: r.ready, statusColor: r.available > 0 ? 'var(--success)' : 'var(--warning)' }
    case 'statefulsets':return { description: `${r.namespace}`, meta: `${r.ready}/${r.replicas}`, statusColor: r.ready === r.replicas ? 'var(--success)' : 'var(--warning)' }
    case 'daemonsets':  return { description: `${r.namespace}`, meta: `${r.ready}/${r.desired}`, statusColor: r.ready === r.desired ? 'var(--success)' : 'var(--warning)' }
    case 'services':    return { description: `${r.namespace} · ${r.cluster_ip}`, meta: r.type, statusColor: 'var(--accent-blue)' }
    case 'ingresses':   return { description: `${r.namespace} · ${(r.hosts||[]).slice(0,2).join(', ')||'-'}`, statusColor: 'var(--accent-blue)' }
    case 'configmaps':  return { description: `${r.namespace}`, meta: `${r.data_count} keys`, statusColor: 'var(--accent-blue)' }
    case 'secrets':     return { description: `${r.namespace}`, meta: r.type, statusColor: 'var(--warning)' }
    case 'nodes':       return { description: r.zone || '', meta: r.ready === 'True' ? 'Ready' : 'NotReady', statusColor: r.ready === 'True' ? 'var(--success)' : 'var(--danger)' }
    default:            return { description: r.namespace || '-', statusColor: 'var(--accent-blue)' }
  }
}

function transformResource(type: string, obj: any): any {
  const md = obj.metadata || {}; const st = obj.status || {}; const sp = obj.spec || {}
  switch (type) {
    case 'pods': {
      const cs = st.containerStatuses || []
      return { name: md.name, namespace: md.namespace, status: st.phase || 'Unknown', ready: `${cs.filter((c: any) => c.ready).length}/${cs.length}`, restarts: cs.reduce((s: number, c: any) => s + (c.restartCount || 0), 0), age: md.creationTimestamp }
    }
    case 'deployments':  return { name: md.name, namespace: md.namespace, ready: `${st.readyReplicas||0}/${sp.replicas||0}`, available: st.availableReplicas||0, age: md.creationTimestamp }
    case 'statefulsets': return { name: md.name, namespace: md.namespace, ready: st.readyReplicas||0, replicas: sp.replicas||0, age: md.creationTimestamp }
    case 'daemonsets':   return { name: md.name, namespace: md.namespace, ready: st.numberReady||0, desired: st.desiredNumberScheduled||0, age: md.creationTimestamp }
    default:             return { name: md.name, namespace: md.namespace, age: md.creationTimestamp }
  }
}
