import { useEffect, useState } from 'react'
import { PullToRefresh, Tag, Button, Empty } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { fmtRelative, fmtTime } from '@/utils/format'

/**
 * 任务中心 - 异步操作进度看板
 *
 * 展示: 扩容/重启/发布等任务的执行状态
 * 分组: 进行中 / 最近完成 / 失败
 */
export default function TasksPage() {
  const nav = useNavigate()
  const [ops, setOps] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setOps(await api.listOperations(50) || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // 每 15 秒轮询进行中任务
    const t = setInterval(() => {
      const hasRunning = ops.some(o => ['executing', 'polling', 'pending', 'prechecking'].includes(o.status))
      if (hasRunning) load()
    }, 15000)
    return () => clearInterval(t)
  }, [])

  const running = ops.filter(o => ['executing', 'polling', 'pending', 'prechecking'].includes(o.status))
  const recentDone = ops.filter(o => ['success', 'failed'].includes(o.status)).slice(0, 20)

  const actionIcon = (action: string) => {
    if (action === 'scale_up') return '⬆️'
    if (action === 'scale_down') return '⬇️'
    if (action === 'restart') return '🔄'
    return '⚙️'
  }

  const actionLabel = (action: string) => {
    if (action === 'scale_up') return '扩容'
    if (action === 'scale_down') return '缩容'
    if (action === 'restart') return '重启'
    return action
  }

  const statusInfo = (s: string) => {
    switch (s) {
      case 'success': return { color: 'var(--success)', text: '✅ 成功', bg: 'rgba(16, 185, 129, 0.1)' }
      case 'failed': return { color: 'var(--danger)', text: '❌ 失败', bg: 'rgba(239, 68, 68, 0.1)' }
      case 'executing': case 'polling': case 'pending': case 'prechecking':
        return { color: 'var(--warning)', text: '⏳ 运行中', bg: 'rgba(245, 158, 11, 0.1)' }
      default: return { color: 'var(--text-tertiary)', text: s, bg: 'transparent' }
    }
  }

  const renderTask = (o: any) => {
    const info = statusInfo(o.status)
    return (
      <div
        key={o.id}
        onClick={() => nav(`/operations`)}
        style={{
          background: info.bg,
          border: `1px solid ${info.color}30`,
          borderLeft: `4px solid ${info.color}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 8,
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <span>{actionIcon(o.action)}</span>
            <span>{actionLabel(o.action)}</span>
            {o.delta && (
              <span style={{ color: 'var(--text-tertiary)' }}>
                Δ {o.delta > 0 ? '+' : ''}{o.delta}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: info.color, fontWeight: 600 }}>{info.text}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {o.cluster_name || `集群 #${o.cluster_id}`} · {o.node_pool_name || `节点池 #${o.node_pool_id}`}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {o.created_at ? fmtRelative(o.created_at) : ''} · {o.created_at ? fmtTime(o.created_at) : ''}
        </div>
        {o.error_msg && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6, background: 'var(--bg-secondary)', padding: 6, borderRadius: 4 }}>
            {o.error_msg}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <span className="title">📋 任务</span>
        <Button size="mini" fill="none" onClick={load} loading={loading}>刷新</Button>
      </div>

      <PullToRefresh onRefresh={load}>
        <div className="page-content">
          {/* 快捷操作区 */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>快捷操作</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Button size="small" color="primary" fill="outline" onClick={() => nav('/scale')}>
                ⬆️ 扩容
              </Button>
              <Button size="small" fill="outline" onClick={() => nav('/operations')}>
                📜 全部历史
              </Button>
            </div>
          </div>

          {/* 进行中任务 */}
          {running.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>
                ⏳ 进行中 ({running.length})
              </div>
              {running.map(renderTask)}
            </div>
          )}

          {/* 最近完成 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              🕒 最近完成
            </div>
            {recentDone.length === 0 ? (
              <Empty
                style={{ padding: '40px 0' }}
                imageStyle={{ width: 60 }}
                description={<span style={{ fontSize: 12 }}>还没有任务记录</span>}
              />
            ) : (
              recentDone.map(renderTask)
            )}
          </div>
        </div>
      </PullToRefresh>
    </div>
  )
}
