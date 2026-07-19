import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TabBar, Badge } from 'antd-mobile'
import { AppOutline, SearchOutline, SetOutline, BellOutline, UnorderedListOutline } from 'antd-mobile-icons'
import { api } from '@/api/client'
import { startAlertPolling, stopAlertPolling } from '@/utils/alertPoller'
import GlobalSearch from './GlobalSearch'

export default function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [alertCount, setAlertCount] = useState(0)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    api.listAlerts(100).then(a => {
      const firing = (a || []).filter((x: any) => x.status === 'firing')
      setAlertCount(firing.length)
    }).catch(() => {})
  }, [loc.pathname])

  // 启动告警轮询（30秒检查一次）
  useEffect(() => {
    startAlertPolling(30000)

    return () => {
      stopAlertPolling()
    }
  }, [])

  // 状态+任务流导向的 Tab（SRE 工作流: 看状态→收告警→诊断→执行）
  const tabs = [
    { key: '/', title: '总览', icon: <AppOutline /> },
    { key: '/alerts', title: '告警', icon: (
      <Badge content={alertCount > 0 ? alertCount : null} style={{ '--right': '-4px', '--top': '-2px' } as any}>
        <BellOutline />
      </Badge>
    )},
    { key: '/diagnose', title: '诊断', icon: <SearchOutline /> },
    { key: '/tasks', title: '任务', icon: <UnorderedListOutline /> },
    { key: '/settings', title: '更多', icon: <SetOutline /> }
  ]

  const active = tabs.find(t => loc.pathname === t.key)?.key
    || tabs.find(t => t.key !== '/' && loc.pathname.startsWith(t.key))?.key
    || '/'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      {/* 内容区：不滚动，让每个页面内部自己控制滚动 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </div>

      {/* 全局搜索浮动按钮 */}
      <div
        onClick={() => setShowSearch(true)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 'calc(env(safe-area-inset-bottom) + 76px)',
          width: 48,
          height: 48,
          borderRadius: 24,
          background: 'linear-gradient(135deg, var(--accent-blue) 0%, #6E9BFF 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          zIndex: 100,
          cursor: 'pointer'
        }}
      >
        <SearchOutline />
      </div>

      {/* 全局搜索面板 */}
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}

      <div style={{
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        <TabBar activeKey={active} onChange={k => nav(k)}>
          {tabs.map(t => (
            <TabBar.Item
              key={t.key}
              icon={t.icon}
              title={t.title}
            />
          ))}
        </TabBar>
      </div>
    </div>
  )
}
