import { useEffect, useState } from 'react'
import { PullToRefresh, Tag } from 'antd-mobile'
import { api } from '@/api/client'
import { fmtRelative, fmtTime } from '@/utils/format'

export default function OperationsPage() {
  const [ops, setOps] = useState<any[]>([])
  const load = async () => setOps(await api.listOperations(100) || [])
  useEffect(() => { load() }, [])

  const tone = (s: string) => {
    switch (s) {
      case 'success': return 'success'
      case 'failed': return 'danger'
      case 'executing':
      case 'polling':
      case 'pending':
      case 'prechecking':
        return 'warning'
      default: return 'default'
    }
  }

  return (
    <div className="page">
      <div className="page-header">操作记录</div>
      <PullToRefresh onRefresh={load}>
        <div className="page-content">
          {ops.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📜</div>
              <div className="empty-text">还没有操作记录</div>
            </div>
          ) : (
            ops.map(o => (
              <div key={o.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>
                    {o.action === 'scale_up' ? '扩容' : o.action === 'scale_down' ? '缩容' : o.action}
                    {o.delta && <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>
                      Δ {o.delta > 0 ? '+' : ''}{o.delta}
                    </span>}
                  </span>
                  <Tag color={tone(o.status)}>{o.status}</Tag>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {fmtTime(o.started_at)} · {fmtRelative(o.started_at)}
                </div>
                {o.trigger_source && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    来源: {o.trigger_source} · ID: {o.operation_id?.slice(0, 8)}...
                  </div>
                )}
                {o.error_msg && (
                  <div style={{
                    marginTop: 6, padding: 8, borderRadius: 4,
                    background: 'var(--danger-bg)', color: 'var(--danger)',
                    fontSize: 12
                  }}>{o.error_msg}</div>
                )}
              </div>
            ))
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}
