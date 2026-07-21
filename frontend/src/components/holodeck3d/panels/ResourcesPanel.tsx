import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import PanelShell from './PanelShell'

/**
 * 资源面板 - 集群资源浏览（替代 ClusterResources 页面的入口）
 * 步骤 1: 选集群
 * 步骤 2: 选资源类型（Pods/Deploys/Services 等）
 * 步骤 3: 显示资源列表 + 搜索
 * 点击资源 → 跳转到 /cluster-resources/:id 详细页
 */

const RESOURCE_TYPES = [
  { key: 'pods', label: 'Pods', icon: '📦', color: '#4fc3f7' },
  { key: 'deployments', label: 'Deployments', icon: '🚀', color: '#a78bfa' },
  { key: 'statefulsets', label: 'StatefulSets', icon: '💾', color: '#fbbf24' },
  { key: 'daemonsets', label: 'DaemonSets', icon: '👾', color: '#4ade80' },
  { key: 'services', label: 'Services', icon: '🌐', color: '#00e5ff' },
  { key: 'ingresses', label: 'Ingresses', icon: '🔀', color: '#ff2d92' },
  { key: 'configmaps', label: 'ConfigMaps', icon: '⚙️', color: '#94a3b8' },
  { key: 'secrets', label: 'Secrets', icon: '🔐', color: '#f472b6' },
  { key: 'nodes', label: 'Nodes', icon: '🖥️', color: '#38bdf8' },
]

export default function ResourcesPanel({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [clusters, setClusters] = useState<any[]>([])
  const [selectedCluster, setSelectedCluster] = useState<any | null>(null)
  const [selectedType, setSelectedType] = useState<string>('pods')
  const [resources, setResources] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [namespace, setNamespace] = useState<string>('')

  useEffect(() => {
    api.listClusters().then(cs => setClusters(cs || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedCluster) return
    setLoading(true)
    setResources([])
    api.get(`/clusters/${selectedCluster.id}/resources/${selectedType}`, {
      params: namespace ? { namespace } : {}
    })
      .then((d: any) => setResources(d || []))
      .catch(() => setResources([]))
      .finally(() => setLoading(false))
  }, [selectedCluster, selectedType, namespace])

  const filtered = useMemo(() => {
    if (!keyword) return resources
    return resources.filter((r: any) =>
      (r.name || '').toLowerCase().includes(keyword.toLowerCase()) ||
      (r.namespace || '').toLowerCase().includes(keyword.toLowerCase())
    )
  }, [resources, keyword])

  return (
    <PanelShell title="集群资源" titleEn="RESOURCES" color="#4ade80" onClose={onClose}>
      {/* 集群选择器 */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid rgba(74,222,128,0.2)',
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {clusters.map(c => {
          const active = selectedCluster?.id === c.id
          return (
            <button
              key={c.id}
              onClick={() => setSelectedCluster(c)}
              style={{
                background: active ? 'rgba(74,222,128,0.15)' : 'transparent',
                border: `1px solid ${active ? '#4ade80' : 'rgba(74,222,128,0.3)'}`,
                color: active ? '#4ade80' : 'rgba(220,240,255,0.7)',
                padding: '6px 12px',
                fontSize: 11,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                borderRadius: 2,
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: 'nowrap',
                textShadow: active ? '0 0 6px #4ade80' : 'none',
              }}
            >
              {c.name || `cluster-${c.id}`}
            </button>
          )
        })}
      </div>

      {!selectedCluster ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          color: 'rgba(220,240,255,0.5)',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.2em',
          fontSize: 12,
        }}>
          ◇ SELECT A CLUSTER<br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>请选择一个集群</span>
        </div>
      ) : (
        <>
          {/* 资源类型标签 */}
          <div style={{
            padding: '8px 12px',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            borderBottom: '1px solid rgba(74,222,128,0.15)',
            flexShrink: 0,
          }}>
            {RESOURCE_TYPES.map(t => {
              const active = selectedType === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setSelectedType(t.key)}
                  style={{
                    background: active ? `${t.color}20` : 'transparent',
                    border: `1px solid ${active ? t.color : 'rgba(120,200,255,0.15)'}`,
                    color: active ? t.color : 'rgba(220,240,255,0.6)',
                    padding: '5px 10px',
                    fontSize: 10,
                    cursor: 'pointer',
                    borderRadius: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.1em',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 12 }}>{t.icon}</span>
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* 搜索 */}
          <div style={{ padding: '8px 12px', flexShrink: 0 }}>
            <input
              placeholder="搜索资源名 / namespace..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(5,10,25,0.7)',
                border: '1px solid rgba(74,222,128,0.25)',
                color: 'rgba(220,240,255,0.95)',
                padding: '6px 10px',
                fontSize: 12,
                fontFamily: 'inherit',
                outline: 'none',
                borderRadius: 2,
              }}
            />
          </div>

          {/* 资源列表 */}
          <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {loading ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                color: '#4ade80',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.2em',
                fontSize: 11,
              }}>
                ◇ LOADING...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'rgba(220,240,255,0.5)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: '0.15em',
              }}>
                ◇ NO {selectedType.toUpperCase()}<br />
                <span style={{ opacity: 0.7 }}>无资源</span>
              </div>
            ) : (
              <>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: 'rgba(220,240,255,0.5)',
                  letterSpacing: '0.15em',
                  padding: '4px 0 6px',
                }}>
                  {filtered.length} 项 · {selectedCluster.name}
                </div>
                {filtered.slice(0, 100).map((r: any, i: number) => (
                  <ResourceRow key={r.name + i} resource={r} type={selectedType} clusterId={selectedCluster.id} onClose={onClose} />
                ))}
                {filtered.length > 100 && (
                  <button
                    onClick={() => {
                      onClose()
                      nav(`/cluster-resources/${selectedCluster.id}`)
                    }}
                    style={{
                      marginTop: 8,
                      background: 'transparent',
                      border: '1px solid #4fc3f7',
                      color: '#4fc3f7',
                      padding: '8px',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: '0.15em',
                    }}
                  >
                    还有 {filtered.length - 100} 项，全屏查看 →
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </PanelShell>
  )
}

function ResourceRow({ resource, type, clusterId, onClose }: any) {
  const nav = useNavigate()
  const statusColor = resource.status === 'Running' || resource.ready === true ? '#4ade80'
    : resource.status === 'Pending' ? '#fbbf24'
    : resource.status === 'Failed' || resource.status === 'CrashLoopBackOff' ? '#ff3b5c'
    : '#94a3b8'

  return (
    <div
      onClick={() => {
        onClose()
        if (type === 'pods') {
          nav(`/cluster-resources/${clusterId}/pod/${resource.namespace}/${resource.name}`)
        } else {
          nav(`/cluster-resources/${clusterId}?tab=${type}&search=${encodeURIComponent(resource.name)}`)
        }
      }}
      style={{
        background: 'rgba(10, 20, 45, 0.4)',
        border: '1px solid rgba(120,200,255,0.15)',
        borderLeft: `2px solid ${statusColor}`,
        padding: '6px 10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          color: 'rgba(220,240,255,0.95)',
          fontFamily: "'JetBrains Mono', monospace",
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {resource.name}
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(220,240,255,0.5)',
          fontFamily: "'JetBrains Mono', monospace",
          marginTop: 1,
        }}>
          {resource.namespace || '-'}{resource.node ? ` · ${resource.node}` : ''}
        </div>
      </div>
      {resource.status && (
        <span style={{
          fontSize: 10,
          color: statusColor,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.1em',
        }}>
          {resource.status}
        </span>
      )}
    </div>
  )
}
