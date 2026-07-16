import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TabBar, Badge } from 'antd-mobile'
import { AppOutline, HistogramOutline, SetOutline, BellOutline, FileOutline } from 'antd-mobile-icons'
import { api } from '@/api/client'

export default function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    api.listAlerts(100).then(a => {
      const firing = (a || []).filter((x: any) => x.status === 'firing')
      setAlertCount(firing.length)
    }).catch(() => {})
  }, [loc.pathname])

  const tabs = [
    { key: '/', title: '首页', icon: <AppOutline /> },
    { key: '/monitor', title: '监控', icon: <HistogramOutline /> },
    { key: '/alerts', title: '告警', icon: (s: boolean) => (
      <Badge content={alertCount > 0 ? alertCount : null} style={{ '--right': '-4px', '--top': '-2px' } as any}>
        <BellOutline />
      </Badge>
    )},
    { key: '/logs', title: '日志', icon: <FileOutline /> },
    { key: '/settings', title: '设置', icon: <SetOutline /> }
  ]

  const active = tabs.find(t => loc.pathname === t.key)?.key
    || tabs.find(t => t.key !== '/' && loc.pathname.startsWith(t.key))?.key
    || '/'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>
      <div style={{
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        <TabBar activeKey={active} onChange={k => nav(k)}>
          {tabs.map(t => (
            <TabBar.Item
              key={t.key}
              icon={typeof t.icon === 'function' ? t.icon(active === t.key) : t.icon}
              title={t.title}
            />
          ))}
        </TabBar>
      </div>
    </div>
  )
}
