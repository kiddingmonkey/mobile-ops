import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { withCache } from '@/utils/apiCache'
import { useTheme } from '@/store'
import HolodeckStarBackground from './HolodeckStarBackground'
import HolodeckRotateHint from './HolodeckRotateHint'
import BridgeTicker from './BridgeTicker'
import QuickCommandDrawer from './QuickCommandDrawer'
import GlassShatter from './GlassShatter'

/**
 * 全息舰桥内页壳
 * 除首页（HolodeckLayout 舰桥主视图）外的所有页面都用这个壳
 * 保持顶部指挥条 + 星空背景 + 底部日志 ticker + 右边缘快速指令
 * 中央区域是 hd-panel 包裹的 Outlet
 */

const ROUTE_LABELS: { path: string; label: string; en: string }[] = [
  { path: '/', label: '舰桥', en: 'BRIDGE' },
  { path: '/alerts', label: '警报', en: 'ALERTS' },
  { path: '/diagnose', label: '诊断', en: 'DIAG' },
  { path: '/tasks', label: '任务', en: 'TASKS' },
  { path: '/settings', label: '设置', en: 'CONFIG' },
]

// 路径段翻译（生成面包屑用）
const SEGMENT_LABELS: Record<string, string> = {
  alerts: 'ALERTS · 警报',
  diagnose: 'DIAG · 诊断',
  tasks: 'TASKS · 任务',
  settings: 'CONFIG · 设置',
  monitor: 'MONITOR · 监控',
  'cluster-resources': 'CLUSTERS · 集群资源',
  'scale': 'SCALE · 扩缩容',
  'logs': 'LOGS · 日志',
  'dialing': 'DIALING · 拨测',
  'operations': 'OPERATIONS · 操作',
  'security-groups': 'SG · 安全组',
  'clusters': 'CLUSTERS · 集群',
  'clouds': 'CLOUDS · 云账号',
  'grafana': 'GRAFANA',
  'prom': 'PROM · Prometheus',
  'vm': 'VM',
  'alertmanager': 'ALERTMANAGER',
  'notification': 'NOTIFY · 通知',
  'ota': 'OTA · 热更新',
  'input': 'INPUT · 输入',
  'new': 'NEW · 新建',
  'edit': 'EDIT · 编辑',
}

function buildBreadcrumb(pathname: string): string[] {
  const segs = pathname.split('/').filter(Boolean)
  return segs.map(s => {
    // 数字或 UUID 段跳过（多为资源 id）
    if (/^\d+$/.test(s) || /^[0-9a-f-]{20,}$/i.test(s)) return `#${s.slice(0, 8)}`
    return SEGMENT_LABELS[s] || s.toUpperCase()
  })
}

export default function HolodeckShell() {
  const nav = useNavigate()
  const loc = useLocation()
  const setMode = useTheme(s => s.setMode)
  const [alerts, setAlerts] = useState<any[]>([])
  const [showQuickCmd, setShowQuickCmd] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  )
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const check = () => setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait')
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  useEffect(() => {
    const load = () => {
      withCache('alerts_50', () => api.listAlerts(50))
        .then(a => setAlerts(a || []))
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const criticals = alerts.filter(a => a.status === 'firing' && a.severity === 'critical').length
  const warnings = alerts.filter(a => a.status === 'firing' && a.severity === 'warning').length
  const combat = criticals > 0

  // 紧急模式 body class
  useEffect(() => {
    if (combat) document.body.classList.add('hd-emergency')
    else document.body.classList.remove('hd-emergency')
    return () => document.body.classList.remove('hd-emergency')
  }, [combat])

  // 从右边缘右滑呼出快速指令
  useEffect(() => {
    let startX = 0, startY = 0, tracking = false
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t.clientX > window.innerWidth - 30) { startX = t.clientX; startY = t.clientY; tracking = true }
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      if (startX - t.clientX > 40 && Math.abs(startY - t.clientY) < 40) {
        setShowQuickCmd(true); tracking = false
      }
    }
    const onEnd = () => { tracking = false }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  if (orientation === 'portrait') {
    return <HolodeckRotateHint />
  }

  const active = ROUTE_LABELS.find(r => r.path === loc.pathname)?.path
    || ROUTE_LABELS.find(r => r.path !== '/' && loc.pathname.startsWith(r.path))?.path
    || '/'

  const crumbs = buildBreadcrumb(loc.pathname)
  const isDeep = crumbs.length > 1

  const statusColor = combat ? 'var(--hd-emergency)' : warnings > 0 ? 'var(--warning)' : 'var(--success)'
  const statusText = combat ? 'RED ALERT' : warnings > 0 ? 'CAUTION' : 'NOMINAL'

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: 'var(--text-primary)',
    }}>
      <HolodeckStarBackground />

      {/* 顶部指挥条（优化版：紧凑布局） */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        paddingTop: 'max(6px, env(safe-area-inset-top))',
        borderBottom: '1px solid rgba(120, 200, 255, 0.15)',
        background: 'rgba(3, 5, 16, 0.6)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 2,
        flexShrink: 0,
        minHeight: 36,
      }}>
        {/* 左侧：返回+Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isDeep && (
            <button
              onClick={() => nav(-1)}
              className="hd-text-mono"
              title="返回"
              style={{
                background: 'transparent',
                border: '1px solid rgba(120, 200, 255, 0.3)',
                color: 'var(--hd-cyan)',
                padding: '3px 8px',
                fontSize: 10,
                letterSpacing: '0.15em',
                cursor: 'pointer',
                borderRadius: 2,
                fontFamily: 'inherit',
                textShadow: '0 0 4px var(--hd-cyan-glow)',
              }}
            >
              ◂
            </button>
          )}
          <div
            className="hd-text-glow hd-text-mono"
            onClick={() => nav('/')}
            style={{
              fontSize: 11,
              letterSpacing: '0.25em',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ◆ STARDECK
          </div>
        </div>

        {/* 中央：导航条 */}
        <div style={{ display: 'flex', gap: 3, flex: 1, minWidth: 0 }}>
          {ROUTE_LABELS.map(r => {
            const isActive = active === r.path
            return (
              <button
                key={r.path}
                onClick={() => nav(r.path)}
                className="hd-text-mono"
                title={r.label}
                style={{
                  background: isActive ? 'rgba(79, 195, 247, 0.15)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--hd-cyan)' : 'rgba(120, 200, 255, 0.15)'}`,
                  color: isActive ? 'var(--hd-cyan)' : 'var(--text-tertiary)',
                  padding: '3px 8px',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  borderRadius: 2,
                  fontFamily: 'inherit',
                  textShadow: isActive ? '0 0 4px var(--hd-cyan-glow)' : 'none',
                  boxShadow: isActive ? '0 0 8px var(--hd-cyan-glow)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.en}
              </button>
            )
          })}
        </div>

        {/* 右侧：状态+退出+时间 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* 状态灯 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              animation: combat ? 'hd-breathe 0.8s ease-in-out infinite' : 'hd-breathe 3s ease-in-out infinite',
            }} />
            <span className="hd-text-mono" style={{
              fontSize: 9,
              color: statusColor,
              letterSpacing: '0.15em',
              fontWeight: 600,
            }}>
              {statusText}
            </span>
          </div>

          {/* 退出 */}
          <button
            onClick={() => setMode('dark')}
            className="hd-text-mono"
            title="退出全息舰桥"
            style={{
              background: 'transparent',
              border: '1px solid rgba(120, 200, 255, 0.25)',
              color: 'var(--text-tertiary)',
              padding: '3px 8px',
              fontSize: 9,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              borderRadius: 2,
              fontFamily: 'inherit',
            }}
          >
            EXIT
          </button>

          {/* 时间 */}
          <div className="hd-text-mono hd-text-glow" style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            minWidth: 70,
            textAlign: 'right',
          }}>
            {time.toTimeString().slice(0, 5)}
          </div>
        </div>
      </div>

      {/* 中央内容（hd-panel 包裹，优化 padding） */}
      <div style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        zIndex: 1,
        padding: '8px 10px',
        overflow: 'hidden',
      }}>
        <div className="hd-panel" style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div className="hd-panel-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
              <span style={{ flexShrink: 0 }}>◆</span>
              {crumbs.map((c, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  <span
                    style={{
                      opacity: i === crumbs.length - 1 ? 1 : 0.55,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c}
                  </span>
                  {i < crumbs.length - 1 && (
                    <span style={{ opacity: 0.4, flexShrink: 0 }}>›</span>
                  )}
                </span>
              ))}
            </span>
            <span className="hd-text-mono" style={{ fontSize: 10, opacity: 0.55, flexShrink: 0, marginLeft: 10 }}>
              {loc.pathname}
            </span>
          </div>
          <div className="hd-panel-corner tl" />
          <div className="hd-panel-corner tr" />
          <div className="hd-panel-corner bl" />
          <div className="hd-panel-corner br" />

          {/* 页面内容滚动容器 */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            position: 'relative',
          }}>
            <Outlet />
          </div>
        </div>
      </div>

      {/* 右边缘快速指令 */}
      <div
        onClick={() => setShowQuickCmd(true)}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 20,
          height: 80,
          background: 'linear-gradient(90deg, transparent 0%, rgba(79,195,247,0.15) 100%)',
          borderLeft: '2px solid var(--hd-cyan)',
          cursor: 'pointer',
          zIndex: 990,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'hd-breathe 2.5s ease-in-out infinite',
        }}
      >
        <span style={{ color: 'var(--hd-cyan)', fontSize: 10 }}>◀</span>
      </div>

      <QuickCommandDrawer open={showQuickCmd} onClose={() => setShowQuickCmd(false)} />

      {/* 底部 ticker */}
      <BridgeTicker alerts={alerts} />

      {/* P0 玻璃碎裂 */}
      <GlassShatter active={combat} />
    </div>
  )
}
