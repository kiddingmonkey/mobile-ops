import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { withCache, getCache } from '@/utils/apiCache'
import { useTheme } from '@/store'
import { hapticLight } from '@/utils/haptics'
import { holoAudio } from '@/utils/holoAudio'
import BridgeTicker from '@/components/holodeck/BridgeTicker'
import QuickCommandDrawer from '@/components/holodeck/QuickCommandDrawer'
import HolodeckRotateHint from '@/components/holodeck/HolodeckRotateHint'
import type { ConsoleData } from './ConsoleStation'

// 懒加载 3D 场景（避免 three.js 打进主 bundle）
const Bridge3DScene = lazy(() => import('./Bridge3DScene'))

// 面板懒加载
const AlertsPanel = lazy(() => import('./panels/AlertsPanel'))
const TasksPanel = lazy(() => import('./panels/TasksPanel'))
const ResourcesPanel = lazy(() => import('./panels/ResourcesPanel'))
const DiagnosePanel = lazy(() => import('./panels/DiagnosePanel'))
const MonitorPanel = lazy(() => import('./panels/MonitorPanel'))
const ConfigPanel = lazy(() => import('./panels/ConfigPanel'))

/**
 * 3D 舰桥入口
 * - 检测 WebGL 可用性，不可用时回退到 fallbackTo2D()
 * - 检测低端设备，动态关闭后处理特效
 * - 聚合数据（告警/集群/任务）传给场景
 * - 控制台点击 → 弹出对应 2D 面板（MVP 阶段沿用现有组件）
 */

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function detectLowPerf(): boolean {
  // 移动端默认低性能模式：保证流畅优先
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  if (isMobile) return true
  const mem = (navigator as any).deviceMemory
  if (typeof mem === 'number' && mem <= 4) return true
  const cores = navigator.hardwareConcurrency
  if (typeof cores === 'number' && cores <= 6) return true
  return false
}

export default function Bridge3D({ onFallback2D }: { onFallback2D: () => void }) {
  const nav = useNavigate()
  const setMode = useTheme(s => s.setMode)
  const [alerts, setAlerts] = useState<any[]>(() => getCache('alerts_50') || [])
  const [clusters, setClusters] = useState<any[]>(() => getCache('clusters') || [])
  const [ops, setOps] = useState<any[]>(() => getCache('ops_10') || [])
  const [showQuickCmd, setShowQuickCmd] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  )
  const [focused, setFocused] = useState<string | null>(null)
  const [panel, setPanel] = useState<string | null>(null)
  const [webglOK] = useState(() => detectWebGL())
  const [lowPerf] = useState(() => detectLowPerf())
  const [time, setTime] = useState(new Date())
  const [audioEnabled, setAudioEnabled] = useState(() => holoAudio.isEnabled())
  const [cameraPreset, setCameraPreset] = useState<'overview' | 'captain' | 'front' | 'orbit' | 'top'>('overview')

  useEffect(() => {
    if (!webglOK) onFallback2D()
  }, [webglOK, onFallback2D])

  // 加载数据
  useEffect(() => {
    const load = () => {
      withCache('alerts_50', () => api.listAlerts(50)).then(a => setAlerts(a || [])).catch(() => {})
      withCache('clusters', () => api.listClusters()).then(c => setClusters(c || [])).catch(() => {})
      withCache('ops_10', () => api.listOperations(10)).then(o => setOps(o || [])).catch(() => {})
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  // 时间
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // 屏幕方向
  useEffect(() => {
    const check = () => setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait')
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // 右滑呼出快速指令
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

  const stats = useMemo(() => {
    const firing = alerts.filter(a => a.status === 'firing')
    const criticals = firing.filter(a => a.severity === 'critical').length
    const warnings = firing.filter(a => a.severity === 'warning').length
    const running = ops.filter(o => ['executing', 'polling', 'pending', 'prechecking'].includes(o.status)).length
    return { criticals, warnings, running }
  }, [alerts, ops])

  const combat = stats.criticals > 0

  const handleConsoleClick = (data: ConsoleData) => {
    hapticLight()
    setFocused(data.id)
    // 500ms 后弹面板，让相机推近动画先跑
    setTimeout(() => {
      holoAudio.panelOpen()
      setPanel(data.id)
    }, 500)
  }

  const closePanel = () => {
    holoAudio.panelClose()
    setPanel(null)
    setFocused(null)
  }

  // 启动环境音
  useEffect(() => {
    holoAudio.startAmbient()
    return () => holoAudio.stopAmbient()
  }, [])

  // 告警音效
  useEffect(() => {
    if (stats.criticals > 0) holoAudio.alertCritical()
    else if (stats.warnings > 0) holoAudio.alertWarning()
  }, [stats.criticals, stats.warnings])

  if (orientation === 'portrait') {
    return <HolodeckRotateHint />
  }

  if (!webglOK) {
    return null
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      {/* 3D 场景 */}
      <Suspense fallback={
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#030510',
          color: '#4fc3f7',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.3em',
          fontSize: 14,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>◆ INITIALIZING BRIDGE...</div>
            <div style={{ fontSize: 11, color: 'rgba(79,195,247,0.5)' }}>正在启动全息舰桥</div>
          </div>
        </div>
      }>
        {/* 面板打开时隐藏整个 3D 场景（含 Html 图标），避免穿透遮挡 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          visibility: panel ? 'hidden' : 'visible',
          transition: 'opacity 0.2s',
          opacity: panel ? 0 : 1,
        }}>
          <Bridge3DScene
            criticals={stats.criticals}
            warnings={stats.warnings}
            running={stats.running}
            clusters={clusters.length}
            okClusters={clusters.length}
            focusedConsole={focused}
            onConsoleClick={handleConsoleClick}
            lowPerf={lowPerf}
            cameraPreset={cameraPreset}
          />
        </div>
      </Suspense>

      {/* 面板打开时的静态背景（不再消耗 GPU） */}
      {panel && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse at center, #1a0842 0%, #060316 55%, #000005 100%)',
          zIndex: 0,
        }} />
      )}

      {/* 顶部 HUD（时间 + 状态 + 退出） */}
      <div style={{
        position: 'fixed',
        top: 'max(8px, env(safe-area-inset-top))',
        left: 12,
        right: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: '0.3em',
          color: '#4fc3f7',
          textShadow: '0 0 8px #4fc3f7',
          fontWeight: 700,
        }}>
          ◆ STARDECK · {time.toTimeString().slice(0, 5)}
        </div>
        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          <button
            onClick={() => {
              const next = !audioEnabled
              holoAudio.setEnabled(next)
              setAudioEnabled(next)
              if (next) holoAudio.consoleClick()
            }}
            style={{
              background: 'rgba(3,5,16,0.6)',
              border: `1px solid ${audioEnabled ? '#4ade80' : 'rgba(120,200,255,0.35)'}`,
              color: audioEnabled ? '#4ade80' : 'rgba(220,240,255,0.6)',
              padding: '4px 10px',
              fontSize: 10,
              letterSpacing: '0.2em',
              fontFamily: 'inherit',
              cursor: 'pointer',
              borderRadius: 2,
              backdropFilter: 'blur(8px)',
            }}
          >
            {audioEnabled ? '🔊' : '🔇'}
          </button>
          <button
            onClick={onFallback2D}
            style={{
              background: 'rgba(3,5,16,0.6)',
              border: '1px solid rgba(120,200,255,0.35)',
              color: '#4fc3f7',
              padding: '4px 10px',
              fontSize: 10,
              letterSpacing: '0.2em',
              fontFamily: 'inherit',
              cursor: 'pointer',
              borderRadius: 2,
              backdropFilter: 'blur(8px)',
            }}
          >
            2D VIEW
          </button>
          <button
            onClick={() => setMode('dark')}
            style={{
              background: 'rgba(3,5,16,0.6)',
              border: '1px solid rgba(120,200,255,0.35)',
              color: 'rgba(220,240,255,0.8)',
              padding: '4px 10px',
              fontSize: 10,
              letterSpacing: '0.2em',
              fontFamily: 'inherit',
              cursor: 'pointer',
              borderRadius: 2,
              backdropFilter: 'blur(8px)',
            }}
          >
            EXIT
          </button>
        </div>
      </div>

      {/* 视角切换（左下） */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom) + 42px)',
        left: 16,
        display: 'flex',
        gap: 4,
        zIndex: 10,
      }}>
        {([
          { key: 'overview', label: '全景', icon: '🌌' },
          { key: 'captain', label: '舰长', icon: '👁' },
          { key: 'front', label: '正屏', icon: '📺' },
          { key: 'orbit', label: '环绕', icon: '🔄' },
          { key: 'top', label: '俯视', icon: '⬇' },
        ] as const).map(p => {
          const active = cameraPreset === p.key
          return (
            <button
              key={p.key}
              onClick={() => { hapticLight(); holoAudio.consoleHover(); setCameraPreset(p.key) }}
              title={p.label}
              style={{
                background: active ? 'rgba(79,195,247,0.2)' : 'rgba(3,5,16,0.6)',
                border: `1px solid ${active ? '#4fc3f7' : 'rgba(120,200,255,0.35)'}`,
                color: active ? '#4fc3f7' : 'rgba(220,240,255,0.7)',
                padding: '5px 8px',
                fontSize: 12,
                cursor: 'pointer',
                borderRadius: 2,
                backdropFilter: 'blur(8px)',
                minWidth: 34,
                textShadow: active ? '0 0 6px #4fc3f7' : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >
              <span>{p.icon}</span>
              <span style={{ fontSize: 8, letterSpacing: '0.05em' }}>{p.label}</span>
            </button>
          )
        })}
      </div>

      {/* 状态灯（右下） */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom) + 42px)',
        right: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: '0.2em',
        color: combat ? '#ff3b5c' : stats.warnings > 0 ? '#fbbf24' : '#4ade80',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 8, height: 8,
          borderRadius: '50%',
          background: 'currentColor',
          boxShadow: '0 0 8px currentColor',
          animation: combat ? 'hd-breathe 0.8s ease-in-out infinite' : 'hd-breathe 3s ease-in-out infinite',
        }} />
        {combat ? 'RED ALERT' : stats.warnings > 0 ? 'CAUTION' : 'NOMINAL'}
      </div>

      {/* 底部 ticker */}
      <BridgeTicker alerts={alerts} />

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
          borderLeft: '2px solid #4fc3f7',
          cursor: 'pointer',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#4fc3f7', fontSize: 10 }}>◀</span>
      </div>

      <QuickCommandDrawer open={showQuickCmd} onClose={() => setShowQuickCmd(false)} />

      {/* 面板浮层 */}
      {panel && (
        <Suspense fallback={null}>
          {panel === 'alerts' && <AlertsPanel onClose={closePanel} />}
          {panel === 'tasks' && <TasksPanel onClose={closePanel} />}
          {panel === 'resources' && <ResourcesPanel onClose={closePanel} />}
          {panel === 'diagnose' && <DiagnosePanel onClose={closePanel} />}
          {panel === 'monitor' && <MonitorPanel onClose={closePanel} />}
          {panel === 'settings' && <ConfigPanel onClose={closePanel} />}
        </Suspense>
      )}
    </div>
  )
}
