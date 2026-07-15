import { useEffect, useState } from 'react'
import { PullToRefresh, Empty } from 'antd-mobile'
import { api } from '@/api/client'
import { fmtRelative, fmtTime } from '@/utils/format'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const load = async () => {
    const a = await api.listAlerts(100)
    setAlerts(a || [])
  }
  useEffect(() => { load() }, [])

  const toneOf = (s: string) =>
    s === 'critical' ? 'danger' : s === 'warning' ? 'warning' : 'info'

  return (
    <div className="page">
      <div className="page-header">告警</div>
      <PullToRefresh onRefresh={load}>
        <div className="page-content">
          {alerts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <div className="empty-text">
                暂无告警<br/>
                配置 alertmanager webhook 到<br/>
                <code style={{ color: 'var(--accent-blue)' }}>/api/v1/alerts/webhook</code>
              </div>
            </div>
          ) : (
            alerts.map(a => (
              <div key={a.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span className={`status-badge ${toneOf(a.severity)}`}>{a.severity}</span>
                      <span style={{ fontWeight: 600 }}>{a.alertname}</span>
                    </div>
                    {a.summary && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {a.summary}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      开始: {fmtTime(a.starts_at)} · {fmtRelative(a.starts_at)}
                    </div>
                  </div>
                  <span className={`status-badge ${a.status === 'firing' ? 'danger' : 'success'}`}>
                    {a.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}
