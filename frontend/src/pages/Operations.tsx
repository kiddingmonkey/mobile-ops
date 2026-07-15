import { useEffect, useState } from 'react'
import { PullToRefresh, Tag, InfiniteScroll } from 'antd-mobile'
import { api } from '@/api/client'
import { fmtRelative, fmtTime } from '@/utils/format'
import StatCard from '@/components/StatCard'

export default function OperationsPage() {
  const [ops, setOps] = useState<any[]>([])
  const load = async () => setOps(await api.listOperations(200) || [])
  useEffect(() => { load() }, [])

  const success = ops.filter(o => o.status === 'success').length
  const failed = ops.filter(o => o.status === 'failed').length
  const running = ops.filter(o => ['executing', 'polling', 'pending', 'prechecking'].includes(o.status)).length

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

  const statusColor = (s: string) => {
    switch (s) {
      case 'success': return 'var(--success)'
      case 'failed': return 'var(--danger)'
      case 'executing': case 'polling': case 'pending': case 'prechecking': return 'var(--warning)'
      default: return 'var(--text-tertiary)'
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="title">操作记录</span>
        <span className="text-xs">{ops.length} 条</span>
      </div>
      <PullToRefresh onRefresh={load}>
        <div className="page-content">
          <StatCard items={[
            { label: '成功', value: success, color: 'var(--success)' },
            { label: '失败', value: failed, color: 'var(--danger)' },
            { label: '进行中', value: running, color: 'var(--warning)' },
            { label: '总计', value: ops.length }
          ]} />

          {ops.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📜</div>
              <div className="empty-title">还没有操作记录</div>
              <div className="empty-text">执行扩缩容后，记录会出现在这里</div>
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              {/* 时间轴竖线 */}
              <div style={{
                position: 'absolute', left: 7, top: 12, bottom: 12,
                width: 2, background: 'var(--border-color)', borderRadius: 1
              }}/>

              {ops.map((o, idx) => (
                <div key={o.id} style={{ position: 'relative', marginBottom: 12 }}>
                  {/* 时间轴圆点 */}
                  <div style={{
                    position: 'absolute', left: -16, top: 16,
                    width: 10, height: 10, borderRadius: '50%',
                    background: statusColor(o.status),
                    border: '2px solid var(--bg-primary)'
                  }}/>

                  <div className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{actionIcon(o.action)}</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          {actionLabel(o.action)}
                        </span>
                        {o.delta && (
                          <span style={{
                            fontSize: 13, fontWeight: 600,
                            color: o.delta > 0 ? 'var(--danger)' : 'var(--success)'
                          }}>{o.delta > 0 ? '+' : ''}{o.delta}</span>
                        )}
                      </div>
                      <span className={`status-badge ${o.status === 'success' ? 'success' : o.status === 'failed' ? 'danger' : 'warning'}`}>
                        {o.status}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {fmtTime(o.started_at)} · {fmtRelative(o.started_at)}
                    </div>

                    {o.trigger_source && (
                      <div className="text-xs" style={{ display: 'flex', gap: 8 }}>
                        <span>来源: {o.trigger_source}</span>
                        <span>ID: {o.operation_id?.slice(0, 8)}</span>
                      </div>
                    )}

                    {o.error_msg && (
                      <div style={{
                        marginTop: 8, padding: '8px 10px', borderRadius: 6,
                        background: 'var(--danger-bg)', color: 'var(--danger)',
                        fontSize: 12, lineHeight: 1.4
                      }}>{o.error_msg}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}
