import { useState } from 'react'
import { Tabs } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import LogsPage from './Logs'
import MonitorPage from './Monitor'

/**
 * 诊断中心 - 合并 Logs + Monitor
 *
 * 定位: SRE 工作流"诊断"环节, 统一日志/监控/Pod 排查入口
 * 未来扩展: 日志-监控联动、快捷诊断按钮 (终端/重启/文件/事件)
 */
export default function DiagnosePage() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'logs' | 'monitor'>('logs')

  return (
    <div className="page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: 'max(12px, env(safe-area-inset-top)) 16px 0',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div className="page-header" style={{ margin: 0, padding: 0, marginBottom: 8 }}>
          🔍 诊断
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          日志、监控、Pod 统一排查入口
        </div>
        <Tabs
          activeKey={tab}
          onChange={k => setTab(k as any)}
          style={{ '--title-font-size': '13px' } as any}
        >
          <Tabs.Tab title="📋 日志" key="logs" />
          <Tabs.Tab title="📊 监控" key="monitor" />
        </Tabs>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'logs' ? <LogsPage /> : <MonitorPage />}
      </div>
    </div>
  )
}
