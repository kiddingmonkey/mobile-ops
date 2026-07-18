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
    <div className="page" style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 0 }}>
      {/* 紧凑分段选择器 - 一行内的胶囊按钮 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'max(8px, env(safe-area-inset-top)) 12px 8px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)',
        gap: 8
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
          🔍 诊断
        </div>

        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderRadius: 20,
          padding: 2,
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setTab('logs')}
            style={{
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: tab === 'logs' ? 600 : 400,
              background: tab === 'logs' ? 'var(--accent-blue)' : 'transparent',
              color: tab === 'logs' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 18,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📋 日志
          </button>
          <button
            onClick={() => setTab('monitor')}
            style={{
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: tab === 'monitor' ? 600 : 400,
              background: tab === 'monitor' ? 'var(--accent-blue)' : 'transparent',
              color: tab === 'monitor' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 18,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📊 监控
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'logs' ? <LogsPage /> : <MonitorPage />}
      </div>
    </div>
  )
}
