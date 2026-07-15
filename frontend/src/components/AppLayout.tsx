import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TabBar } from 'antd-mobile'
import { AppOutline, HistogramOutline, AlipayCircleFill, SetOutline, BellOutline } from 'antd-mobile-icons'

export default function AppLayout() {
  const nav = useNavigate()
  const loc = useLocation()

  const tabs = [
    { key: '/', title: '首页', icon: <AppOutline /> },
    { key: '/monitor', title: '监控', icon: <HistogramOutline /> },
    { key: '/alerts', title: '告警', icon: <BellOutline /> },
    { key: '/operations', title: '记录', icon: <AlipayCircleFill /> },
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
            <TabBar.Item key={t.key} icon={t.icon} title={t.title} />
          ))}
        </TabBar>
      </div>
    </div>
  )
}
