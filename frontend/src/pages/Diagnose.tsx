import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LogsPage from './Logs'
import MonitorPage from './Monitor'

/**
 * 诊断中心 - 紧凑分段选择器，节省纵向空间
 */
export default function DiagnosePage() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'logs' | 'monitor'>('logs')

  return (
    <div className="page">
      {/* 极简顶部：只有切换按钮，去掉标题 */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(6px, env(safe-area-inset-top)) 12px 6px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderRadius: 16,
          padding: 2,
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setTab('logs')}
            style={{
              padding: '3px 12px',
              fontSize: 11,
              fontWeight: tab === 'logs' ? 600 : 400,
              background: tab === 'logs' ? 'var(--accent-blue)' : 'transparent',
              color: tab === 'logs' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📋 日志
          </button>
          <button
            onClick={() => setTab('monitor')}
            style={{
              padding: '3px 12px',
              fontSize: 11,
              fontWeight: tab === 'monitor' ? 600 : 400,
              background: tab === 'monitor' ? 'var(--accent-blue)' : 'transparent',
              color: tab === 'monitor' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📊 监控
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'logs' ? <LogsPage /> : <MonitorPage />}
      </div>
    </div>
  )
}
