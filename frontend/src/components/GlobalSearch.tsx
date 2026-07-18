import { useState, useEffect, useRef } from 'react'
import { SearchBar, List, Tag } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { CloseOutline, ClockCircleOutline } from 'antd-mobile-icons'
import { api } from '@/api/client'

/**
 * 全局搜索组件 - SRE 移动端快速跳转
 *
 * 支持:
 * - 集群名/Pod 名/命名空间模糊匹配
 * - 快捷命令 (扩容/日志/告警/监控/安全组)
 * - 关键词前缀语法 (log:error / pod:xxx / cluster:xxx)
 * - 最近搜索历史 (localStorage)
 */

interface SearchResult {
  type: 'cluster' | 'pod' | 'command' | 'namespace' | 'action'
  title: string
  subtitle?: string
  icon: string
  onClick: () => void
}

const HISTORY_KEY = 'global_search_history'
const MAX_HISTORY = 8

// 快捷命令列表
const QUICK_COMMANDS = [
  { keywords: ['扩容', 'scale', 'kuorong'], title: '扩容', icon: '⚡', path: '/scale' },
  { keywords: ['告警', 'alert', 'gaojing'], title: '告警中心', icon: '🔔', path: '/alerts' },
  { keywords: ['日志', 'log', 'rizhi'], title: '日志', icon: '📋', path: '/diagnose' },
  { keywords: ['监控', 'monitor', 'jiankong'], title: '监控', icon: '📊', path: '/diagnose' },
  { keywords: ['安全组', 'security', 'sg', 'anquanzu', '白名单'], title: '安全组白名单', icon: '🔒', path: '/settings/security-groups' },
  { keywords: ['集群', 'cluster', 'jiqun', 'k8s'], title: '集群管理', icon: '☸️', path: '/settings/clusters' },
  { keywords: ['设置', 'setting', 'shezhi'], title: '设置', icon: '⚙️', path: '/settings' },
  { keywords: ['任务', 'task', 'renwu', '操作记录'], title: '任务中心', icon: '📋', path: '/tasks' },
  { keywords: ['通知', 'notification', 'tongzhi', '飞书', 'feishu'], title: '通知渠道', icon: '📢', path: '/settings/notifications' },
  { keywords: ['诊断', 'diagnose', 'zhenduan'], title: '诊断中心', icon: '🔍', path: '/diagnose' },
  { keywords: ['ota', '更新', 'update'], title: 'OTA 调试', icon: '🔧', path: '/settings/ota-debug' }
]

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [clusters, setClusters] = useState<any[]>([])
  const [pods, setPods] = useState<any[]>([])
  const [namespaces, setNamespaces] = useState<{ cluster: any; ns: string }[]>([])
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<any>(null)

  // 加载所有集群和命名空间（首次打开）
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const cs = await api.listClusters().catch(() => [])
        setClusters(cs || [])
        // 并发拉取每个集群的命名空间
        const nsList: { cluster: any; ns: string }[] = []
        await Promise.all(
          (cs || []).map(async (c: any) => {
            try {
              const ns = await api.listNamespaces(c.id)
              ns.forEach((n: string) => nsList.push({ cluster: c, ns: n }))
            } catch {}
          })
        )
        setNamespaces(nsList)
      } finally {
        setLoading(false)
      }
    }
    load()

    // 聚焦搜索框
    setTimeout(() => {
      inputRef.current?.focus?.()
    }, 100)
  }, [])

  // 关键词变化时搜索 Pod（防抖 300ms）
  useEffect(() => {
    if (!keyword || keyword.startsWith('log:') || keyword.startsWith('cluster:')) {
      setPods([])
      return
    }
    const kw = keyword.replace(/^pod:/, '').trim()
    if (kw.length < 2) {
      setPods([])
      return
    }

    const timer = setTimeout(async () => {
      // 只搜索前 3 个集群的所有 namespace 里的 pod
      const results: any[] = []
      const targets = namespaces.slice(0, 30) // 限制搜索范围
      await Promise.all(
        targets.map(async ({ cluster, ns }) => {
          try {
            const ps = await api.listPods(cluster.id, ns)
            const matched = (ps || [])
              .filter((p: any) => p.name?.toLowerCase().includes(kw.toLowerCase()))
              .slice(0, 5)
              .map((p: any) => ({ ...p, cluster, namespace: ns }))
            results.push(...matched)
          } catch {}
        })
      )
      setPods(results.slice(0, 20))
    }, 300)

    return () => clearTimeout(timer)
  }, [keyword, namespaces])

  // 保存搜索历史
  const saveHistory = (kw: string) => {
    if (!kw.trim()) return
    const next = [kw, ...history.filter(h => h !== kw)].slice(0, MAX_HISTORY)
    setHistory(next)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
  }

  // 组装搜索结果
  const results: SearchResult[] = []

  if (keyword.trim()) {
    const kw = keyword.toLowerCase().trim()

    // 前缀语法处理
    if (keyword.startsWith('log:')) {
      const term = keyword.slice(4).trim()
      results.push({
        type: 'action',
        title: `在日志中搜索: ${term || '所有日志'}`,
        icon: '📋',
        onClick: () => {
          saveHistory(keyword)
          nav(`/diagnose?tab=logs&q=${encodeURIComponent(term)}`)
          onClose()
        }
      })
    } else {
      // 快捷命令匹配
      QUICK_COMMANDS.forEach(cmd => {
        if (cmd.keywords.some(k => k.toLowerCase().includes(kw)) || cmd.title.toLowerCase().includes(kw)) {
          results.push({
            type: 'command',
            title: cmd.title,
            subtitle: '快捷入口',
            icon: cmd.icon,
            onClick: () => {
              saveHistory(keyword)
              nav(cmd.path)
              onClose()
            }
          })
        }
      })

      // 集群匹配
      clusters.forEach(c => {
        if ((c.name || '').toLowerCase().includes(kw) || (c.display_name || '').toLowerCase().includes(kw)) {
          results.push({
            type: 'cluster',
            title: c.display_name || c.name,
            subtitle: `集群 · ${c.provider}`,
            icon: '☸️',
            onClick: () => {
              saveHistory(keyword)
              nav(`/clusters/${c.id}/resources`)
              onClose()
            }
          })
        }
      })

      // Pod 匹配
      pods.forEach(p => {
        results.push({
          type: 'pod',
          title: p.name,
          subtitle: `Pod · ${p.cluster?.display_name || p.cluster?.name} / ${p.namespace}`,
          icon: '📦',
          onClick: () => {
            saveHistory(keyword)
            nav(`/clusters/${p.cluster.id}/pods/${p.namespace}/${p.name}`)
            onClose()
          }
        })
      })

      // 命名空间匹配（如果关键词不包含 pod:）
      if (!keyword.startsWith('pod:')) {
        namespaces
          .filter(({ ns }) => ns.toLowerCase().includes(kw))
          .slice(0, 5)
          .forEach(({ cluster, ns }) => {
            results.push({
              type: 'namespace',
              title: ns,
              subtitle: `命名空间 · ${cluster.display_name || cluster.name}`,
              icon: '📁',
              onClick: () => {
                saveHistory(keyword)
                nav(`/clusters/${cluster.id}/resources?namespace=${ns}`)
                onClose()
              }
            })
          })
      }
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-primary)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 顶部搜索栏 */}
      <div style={{
        padding: 'max(12px, env(safe-area-inset-top)) 12px 8px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }}>
        <div style={{ flex: 1 }}>
          <SearchBar
            ref={inputRef}
            placeholder="搜索集群 / Pod / 命令... (如: log:error 或 pod:nginx)"
            value={keyword}
            onChange={setKeyword}
            showCancelButton={false}
            style={{ '--height': '36px' } as any}
          />
        </div>
        <div
          onClick={onClose}
          style={{
            fontSize: 14,
            color: 'var(--accent-blue)',
            cursor: 'pointer',
            padding: '4px 8px',
            fontWeight: 500
          }}
        >
          取消
        </div>
      </div>

      {/* 结果区域 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {!keyword.trim() ? (
          // 无关键词：显示历史和使用提示
          <div>
            {history.length > 0 && (
              <div style={{ padding: '8px 16px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>最近搜索</span>
                  <span
                    onClick={clearHistory}
                    style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}
                  >
                    清除
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {history.map((h, i) => (
                    <Tag
                      key={i}
                      onClick={() => setKeyword(h)}
                      style={{
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '4px 10px',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <ClockCircleOutline fontSize={10} style={{ marginRight: 4 }} />
                      {h}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '16px', color: 'var(--text-tertiary)', fontSize: 12, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>💡 搜索提示</div>
              <div>• 输入 <code style={{ color: 'var(--accent-blue)' }}>扩容</code>、<code style={{ color: 'var(--accent-blue)' }}>告警</code>、<code style={{ color: 'var(--accent-blue)' }}>日志</code> 快速跳转</div>
              <div>• 输入集群名或 Pod 名 (如 <code style={{ color: 'var(--accent-blue)' }}>nginx</code>) 直接定位</div>
              <div>• 前缀语法: <code style={{ color: 'var(--accent-blue)' }}>log:error</code> 搜日志、<code style={{ color: 'var(--accent-blue)' }}>pod:xxx</code> 只搜 Pod</div>
              <div>• 支持中文和拼音首字母</div>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div>没有匹配结果</div>
            {loading && <div style={{ fontSize: 11, marginTop: 8 }}>正在搜索 Pod...</div>}
          </div>
        ) : (
          <List>
            {results.map((r, i) => (
              <List.Item
                key={i}
                prefix={<span style={{ fontSize: 20 }}>{r.icon}</span>}
                description={r.subtitle}
                onClick={r.onClick}
                arrow={false}
              >
                {r.title}
              </List.Item>
            ))}
          </List>
        )}
      </div>
    </div>
  )
}
