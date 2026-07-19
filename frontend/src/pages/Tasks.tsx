import { useEffect, useState, useCallback } from 'react'
import { PullToRefresh, Button, Empty, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { fmtRelative, fmtTime } from '@/utils/format'
import { hapticLight } from '@/utils/haptics'

/**
 * 任务与运维中心 - 综合 SRE 场景入口
 *
 * 上半区：常用运维场景快捷入口（容器/中间件/AI/云资源）
 * 下半区：正在执行的任务 + 历史操作
 */
export default function TasksPage() {
  const nav = useNavigate()
  const [ops, setOps] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOps(await api.listOperations(50) || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => {
      const hasRunning = ops.some(o => ['executing', 'polling', 'pending', 'prechecking'].includes(o.status))
      if (hasRunning) load()
    }, 15000)
    return () => clearInterval(t)
  }, [])

  const running = ops.filter(o => ['executing', 'polling', 'pending', 'prechecking'].includes(o.status))
  const recentDone = ops.filter(o => ['success', 'failed'].includes(o.status)).slice(0, 15)

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
      case 'success': return { color: 'var(--success)', text: '✓ 成功', bg: 'var(--success-bg)' }
      case 'failed': return { color: 'var(--danger)', text: '✗ 失败', bg: 'var(--danger-bg)' }
      default: return { color: 'var(--warning)', text: '⏳ 运行中', bg: 'var(--warning-bg)' }
    }
  }

  // 综合运维场景卡片
  const scenarios = [
    {
      title: '容器运维',
      icon: '☸️',
      color: 'var(--accent-blue)',
      items: [
        { icon: '⚡', label: '紧急扩容', onClick: () => nav('/scale') },
        { icon: '📋', label: '查日志', onClick: () => nav('/diagnose') },
        { icon: '📊', label: '看监控', onClick: () => nav('/diagnose') },
        { icon: '🔒', label: '安全组', onClick: () => nav('/settings/security-groups') }
      ]
    },
    {
      title: '中间件运维',
      icon: '⚙️',
      color: 'var(--success)',
      items: [
        { icon: '🗄️', label: 'MySQL', onClick: () => Toast.show({ content: '开发中：MySQL 慢查/连接', duration: 1500 }) },
        { icon: '📦', label: 'Redis', onClick: () => Toast.show({ content: '开发中：Redis 内存/慢命令', duration: 1500 }) },
        { icon: '🐰', label: 'RabbitMQ', onClick: () => Toast.show({ content: '开发中：MQ 堆积/消费者', duration: 1500 }) },
        { icon: '🔎', label: 'ES', onClick: () => Toast.show({ content: '开发中：ES 索引/分片', duration: 1500 }) }
      ]
    },
    {
      title: 'AI 运维',
      icon: '🤖',
      color: 'var(--warning)',
      items: [
        { icon: '🚀', label: '推理服务', onClick: () => Toast.show({ content: '开发中：LLM 服务健康', duration: 1500 }) },
        { icon: '🎯', label: 'GPU 监控', onClick: () => Toast.show({ content: '开发中：GPU 使用率/温度', duration: 1500 }) },
        { icon: '📈', label: 'Token 用量', onClick: () => Toast.show({ content: '开发中：模型调用量分析', duration: 1500 }) },
        { icon: '🔧', label: '模型部署', onClick: () => Toast.show({ content: '开发中：模型版本管理', duration: 1500 }) }
      ]
    },
    {
      title: '云资源',
      icon: '☁️',
      color: 'var(--text-secondary)',
      items: [
        { icon: '💾', label: '云盘扩容', onClick: () => Toast.show({ content: '开发中：CBS 扩容/快照', duration: 1500 }) },
        { icon: '🌐', label: 'CLB/DNS', onClick: () => Toast.show({ content: '开发中：负载均衡/DNS', duration: 1500 }) },
        { icon: '💰', label: '成本分析', onClick: () => Toast.show({ content: '开发中：云资源成本', duration: 1500 }) },
        { icon: '🔐', label: '证书管理', onClick: () => Toast.show({ content: '开发中：SSL 证书到期', duration: 1500 }) }
      ]
    }
  ]

  return (
    <div className="page">
      <div style={{
        flexShrink: 0,
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>📋 运维</span>
        <Button size="mini" fill="none" onClick={load} loading={loading}>刷新</Button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <PullToRefresh onRefresh={load}>
          <div style={{ padding: '0 12px 16px' }}>

          {/* === 综合运维场景入口 === */}
          {scenarios.map((s, idx) => (
            <div key={idx} style={{
              background: 'var(--bg-elevated)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.title}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {s.items.map((it, i) => (
                  <div
                    key={i}
                    onClick={() => { hapticLight(); it.onClick() }}
                    style={{
                      padding: '10px 4px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 8,
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontSize: 18 }}>{it.icon}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{it.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* === 进行中任务 === */}
          {running.length > 0 && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>
                ⏳ 进行中 ({running.length})
              </div>
              {running.map((o: any) => {
                const info = statusInfo(o.status)
                return (
                  <div
                    key={o.id}
                    onClick={() => nav('/operations')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 0', borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{actionIcon(o.action)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                        {actionLabel(o.action)}
                        {o.delta ? ` ${o.delta > 0 ? '+' : ''}${o.delta}` : ''}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {o.cluster_name || `集群 #${o.cluster_id}`} · {o.node_pool_name || '-'}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: info.color, fontWeight: 600 }}>{info.text}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* === 最近操作 === */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>🕒 最近操作</span>
              <span onClick={() => nav('/operations')} style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}>
                全部 ›
              </span>
            </div>
            {recentDone.length === 0 ? (
              <Empty description={<span style={{ fontSize: 11 }}>还没有操作记录</span>} imageStyle={{ width: 48 }} style={{ padding: '20px 0' }} />
            ) : (
              recentDone.slice(0, 8).map((o: any) => {
                const info = statusInfo(o.status)
                return (
                  <div
                    key={o.id}
                    onClick={() => nav('/operations')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 0', borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{actionIcon(o.action)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {actionLabel(o.action)}
                        {o.delta ? ` ${o.delta > 0 ? '+' : ''}${o.delta}` : ''}
                        {o.node_pool_name && <span style={{ color: 'var(--text-tertiary)' }}> · {o.node_pool_name}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmtRelative(o.created_at || o.started_at)}</span>
                    <span style={{ fontSize: 10, color: info.color, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>
                      {o.status === 'success' ? '✓' : o.status === 'failed' ? '✗' : o.status}
                    </span>
                  </div>
                )
              })
            )}
          </div>

        </div>
      </PullToRefresh>
      </div>
    </div>
  )
}
