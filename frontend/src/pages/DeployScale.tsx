import { useEffect, useState, useCallback } from 'react'
import { Button, Toast, Dialog, Stepper, SearchBar, SpinLoading, Empty } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useUI } from '@/store'
import PageShell from '@/components/PageShell'
import { hapticMedium, hapticSuccess, hapticError } from '@/utils/haptics'

/**
 * Deployment / StatefulSet 快速扩缩容
 *
 * SRE 日常真正需要的扩容：调整 workload 副本数，而非购买新节点
 */
export default function DeployScalePage() {
  const nav = useNavigate()
  const activeClusterId = useUI(s => s.activeClusterId)
  const setActive = useUI(s => s.setActiveCluster)

  const [clusters, setClusters] = useState<any[]>([])
  const [clusterId, setClusterId] = useState<number | null>(activeClusterId)
  const [workloads, setWorkloads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<'deployments' | 'statefulsets'>('deployments')
  const [keyword, setKeyword] = useState('')
  const [ns, setNs] = useState('')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [scaling, setScaling] = useState<Record<string, number>>({})

  useEffect(() => {
    api.listClusters().then(cs => {
      setClusters(cs || [])
      if (!clusterId && cs && cs.length > 0) {
        setClusterId(cs[0].id)
        setActive(cs[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!clusterId) return
    api.listNamespaces(clusterId).then(setNamespaces).catch(() => {})
  }, [clusterId])

  const load = useCallback(async () => {
    if (!clusterId) return
    setLoading(true)
    try {
      const data = await api.get(`/clusters/${clusterId}/resources/${type}`, {
        params: ns ? { namespace: ns } : {}
      })
      setWorkloads(data || [])
    } catch (e: any) {
      Toast.show({ content: '加载失败: ' + (e?.response?.data?.error || e?.message), icon: 'fail' })
      setWorkloads([])
    } finally {
      setLoading(false)
    }
  }, [clusterId, type, ns])

  useEffect(() => { load() }, [load])

  const doScale = async (w: any, newReplicas: number) => {
    if (newReplicas < 0) return
    hapticMedium()
    const curReplicas = getReplicas(w)
    if (newReplicas === curReplicas) return

    const ok = await Dialog.confirm({
      content: `${w.name}: ${curReplicas} → ${newReplicas} 副本？`,
      confirmText: '确认',
      cancelText: '取消'
    })
    if (!ok) return

    try {
      await api.post(`/clusters/${clusterId}/workloads/${type}/${w.namespace}/${w.name}/scale`, {
        replicas: newReplicas
      })
      hapticSuccess()
      Toast.show({ content: `已${newReplicas > curReplicas ? '扩容' : '缩容'}到 ${newReplicas}`, icon: 'success' })
      setScaling({}) // 清除本地编辑状态
      setTimeout(load, 500)
    } catch (e: any) {
      hapticError()
      Toast.show({ content: '失败: ' + (e?.response?.data?.error || e?.message), icon: 'fail' })
    }
  }

  const doRestart = async (w: any) => {
    const ok = await Dialog.confirm({
      content: `确认滚动重启 ${w.name}？副本会依次重启，不影响服务`,
      confirmText: '重启', cancelText: '取消'
    })
    if (!ok) return
    hapticMedium()
    try {
      await api.post(`/clusters/${clusterId}/workloads/${type}/${w.namespace}/${w.name}/restart`)
      hapticSuccess()
      Toast.show({ content: '已触发滚动重启', icon: 'success' })
    } catch (e: any) {
      hapticError()
      Toast.show({ content: '失败: ' + (e?.response?.data?.error || e?.message), icon: 'fail' })
    }
  }

  const filtered = keyword
    ? workloads.filter(w => w.name.toLowerCase().includes(keyword.toLowerCase()))
    : workloads

  return (
    <PageShell title="紧急扩容" onBack={() => nav(-1)}>
      {/* 顶部集群+类型切换 */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center'
      }}>
        <select
          value={clusterId || ''}
          onChange={e => { const id = Number(e.target.value); setClusterId(id); setActive(id) }}
          style={{ flex: 1, minWidth: 120, padding: '5px', fontSize: 12, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 4 }}
        >
          {clusters.map(c => <option key={c.id} value={c.id}>{c.display_name || c.name}</option>)}
        </select>
        <div style={{
          display: 'flex', background: 'var(--bg-secondary)', borderRadius: 16,
          padding: 2, border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setType('deployments')}
            style={{
              padding: '3px 10px', fontSize: 11, fontWeight: type === 'deployments' ? 600 : 400,
              background: type === 'deployments' ? 'var(--accent-blue)' : 'transparent',
              color: type === 'deployments' ? '#fff' : 'var(--text-secondary)',
              border: 'none', borderRadius: 14
            }}
          >Deploy</button>
          <button
            onClick={() => setType('statefulsets')}
            style={{
              padding: '3px 10px', fontSize: 11, fontWeight: type === 'statefulsets' ? 600 : 400,
              background: type === 'statefulsets' ? 'var(--accent-blue)' : 'transparent',
              color: type === 'statefulsets' ? '#fff' : 'var(--text-secondary)',
              border: 'none', borderRadius: 14
            }}
          >StatefulSet</button>
        </div>
      </div>

      {/* 搜索 + ns 过滤 */}
      <div style={{
        padding: '6px 12px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', gap: 6, alignItems: 'center'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchBar placeholder="搜索名称" value={keyword} onChange={setKeyword} style={{ '--height': '28px', '--font-size': '12px' } as any} />
        </div>
        {namespaces.length > 0 && (
          <select
            value={ns} onChange={e => setNs(e.target.value)}
            style={{
              padding: '4px 6px', fontSize: 11,
              background: ns ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: ns ? '#fff' : 'var(--text-secondary)',
              border: '1px solid ' + (ns ? 'var(--accent-blue)' : 'var(--border-color)'),
              borderRadius: 4, maxWidth: 100
            }}
          >
            <option value="">全部 ns</option>
            {namespaces.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </div>

      {/* 说明条 */}
      <div style={{
        padding: '6px 12px', fontSize: 10, color: 'var(--text-tertiary)',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        💡 直接调整副本数，无需购买节点。建议先看资源余量再扩容。
      </div>

      {/* 列表 */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <SpinLoading style={{ '--size': '32px' }} />
          </div>
        ) : filtered.length === 0 ? (
          <Empty description={keyword ? '没有匹配' : `没有 ${type}`} style={{ padding: '60px 0' }} />
        ) : (
          filtered.map(w => {
            const rep = getReplicas(w)
            const key = `${w.namespace}/${w.name}`
            const target = scaling[key] ?? rep
            return (
              <div
                key={key}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border-color)',
                  background: 'var(--bg-elevated)'
                }}
              >
                {/* 标题 + 状态 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: (w.available > 0 || w.ready === w.replicas) ? 'var(--success)' : 'var(--warning)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{w.namespace} · Ready {w.ready}</div>
                  </div>
                  <Button
                    size="mini" fill="outline"
                    onClick={() => doRestart(w)}
                    style={{ fontSize: 10, flexShrink: 0 }}
                  >
                    🔄 重启
                  </Button>
                </div>

                {/* 副本调整 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>副本</span>
                  <Stepper
                    value={target}
                    min={0}
                    max={100}
                    onChange={(v) => setScaling(prev => ({ ...prev, [key]: v }))}
                    style={{ '--height': '28px', '--input-width': '40px' } as any}
                  />
                  {target !== rep && (
                    <>
                      <span style={{ fontSize: 10, color: target > rep ? 'var(--success)' : 'var(--warning)' }}>
                        {target > rep ? '↑' : '↓'} {Math.abs(target - rep)}
                      </span>
                      <div style={{ flex: 1 }} />
                      <Button
                        size="mini" color="primary"
                        onClick={() => doScale(w, target)}
                        style={{ fontSize: 11, flexShrink: 0 }}
                      >
                        应用 → {target}
                      </Button>
                    </>
                  )}
                  {target === rep && (
                    <>
                      <div style={{ flex: 1 }} />
                      {/* 快捷预设 */}
                      {[rep + 1, rep + 2, rep * 2].filter(v => v <= 100 && v !== rep).slice(0, 2).map(v => (
                        <Button
                          key={v} size="mini" fill="outline"
                          onClick={() => setScaling(prev => ({ ...prev, [key]: v }))}
                          style={{ fontSize: 10, minWidth: 32 }}
                        >
                          {v}
                        </Button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 底部：跳转节点池扩容 */}
      <div style={{
        position: 'fixed', bottom: 'env(safe-area-inset-bottom)', left: 0, right: 0,
        padding: 8, background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-color)', textAlign: 'center'
      }}>
        <Button
          size="mini" fill="none"
          onClick={() => nav('/scale-nodes')}
          style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          节点池扩缩容 (需要付费) ›
        </Button>
      </div>
    </PageShell>
  )
}

function getReplicas(w: any): number {
  if (w.replicas != null) return w.replicas
  const ready = w.ready
  if (typeof ready === 'string' && ready.includes('/')) {
    const parts = ready.split('/')
    return parseInt(parts[1]) || 0
  }
  return 0
}
