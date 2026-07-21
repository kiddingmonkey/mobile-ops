import { useState, useEffect, lazy, Suspense } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TabBar, Badge } from 'antd-mobile'
import { AppOutline, SearchOutline, SetOutline, BellOutline, UnorderedListOutline } from 'antd-mobile-icons'
import { api } from '@/api/client'
import { startAlertPolling, stopAlertPolling } from '@/utils/alertPoller'
import { useTheme, resolveTheme } from '@/store'
import GlobalSearch from './GlobalSearch'
import GuofengBackground from './GuofengBackground'
import HolodeckLayout from './holodeck/HolodeckLayout'
import HolodeckShell from './holodeck/HolodeckShell'

const Bridge3D = lazy(() => import('./holodeck3d/Bridge3D'))

// 全息首页：3D + 2D 切换（记忆用户选择）
function HolodeckHome() {
  const forced2D = typeof localStorage !== 'undefined' && localStorage.getItem('holodeck_force_2d') === '1'
  const [use2D, set2D] = useState(forced2D)
  if (use2D) {
    return (
      <div style={{ position: 'relative', height: '100vh' }}>
        <HolodeckLayout />
        <button
          onClick={() => { localStorage.removeItem('holodeck_force_2d'); set2D(false) }}
          style={{
            position: 'fixed',
            top: 'max(8px, env(safe-area-inset-top))',
            right: 100,
            zIndex: 999,
            background: 'rgba(3,5,16,0.7)',
            border: '1px solid rgba(120,200,255,0.4)',
            color: '#4fc3f7',
            padding: '4px 10px',
            fontSize: 10,
            letterSpacing: '0.2em',
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            borderRadius: 2,
          }}
        >
          3D VIEW
        </button>
      </div>
    )
  }
  return (
    <Suspense fallback={
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#030510', color: '#4fc3f7',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.3em', fontSize: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>◆ LOADING 3D BRIDGE...</div>
          <div style={{ fontSize: 11, color: 'rgba(79,195,247,0.5)' }}>加载 3D 舰桥中</div>
        </div>
      </div>
    }>
      <Bridge3D onFallback2D={() => {
        localStorage.setItem('holodeck_force_2d', '1')
        set2D(true)
      }} />
    </Suspense>
  )
}

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

  const themeMode = useTheme(s => s.mode)
  const resolvedTheme = resolveTheme(themeMode)
  const isGuofeng = resolvedTheme === 'guofeng'
  const isHolodeck = resolvedTheme === 'holodeck'

  // Holodeck 模式：首页是 3D 舰桥（可切 2D），其他所有页面走全息壳
  if (isHolodeck) {
    if (loc.pathname === '/') return <HolodeckHome />
    return <HolodeckShell />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      {isGuofeng && <GuofengBackground />}
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
          background: isGuofeng
            ? 'linear-gradient(135deg, var(--gf-cinnabar) 0%, #8B2E22 100%)'
            : 'linear-gradient(135deg, var(--accent-blue) 0%, #6E9BFF 100%)',
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
