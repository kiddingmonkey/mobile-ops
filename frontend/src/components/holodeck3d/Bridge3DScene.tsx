import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import BridgeFloor from './BridgeFloor'
import CenterBeam from './CenterBeam'
import ConsoleStation, { ConsoleData } from './ConsoleStation'
import MainScreen from './MainScreen'
import Effects from './Effects'
import Starfield from './Starfield'
import CameraRig from './CameraRig'
import CaptainAvatar from './CaptainAvatar'
import BridgeWalls from './BridgeWalls'
import SideConsoles from './SideConsoles'
import FloatingOrbs from './FloatingOrbs'

interface Props {
  criticals: number
  warnings: number
  running: number
  clusters: number
  okClusters: number
  focusedConsole: string | null
  onConsoleClick: (data: ConsoleData) => void
  lowPerf?: boolean
}

/**
 * 6 个环绕控制台的位置（半径 5，均匀分布，避开正前方主屏幕方向）
 * 控制台朝向中心（rotationY 使其正面对着玩家）
 */
function buildConsoles(badges: { alerts: number; tasks: number }): ConsoleData[] {
  const R = 5.5
  const configs = [
    { id: 'alerts', label: '警报', labelEn: 'ALERTS', icon: '🚨', color: '#ff2d92', badge: badges.alerts || undefined },
    { id: 'diagnose', label: '诊断', labelEn: 'DIAG', icon: '🔍', color: '#4fc3f7' },
    { id: 'tasks', label: '任务', labelEn: 'TASKS', icon: '⚙️', color: '#a78bfa', badge: badges.tasks || undefined },
    { id: 'resources', label: '资源', labelEn: 'RESOURCES', icon: '📦', color: '#4ade80' },
    { id: 'monitor', label: '监控', labelEn: 'MONITOR', icon: '📊', color: '#fbbf24' },
    { id: 'settings', label: '配置', labelEn: 'CONFIG', icon: '⚡', color: '#00e5ff' },
  ]
  // 6 个位置：120°/240° 是主屏幕方向留白，其他均匀
  // 采用左右各 3 个：-120°/-90°/-60° 和 60°/90°/120°（角度以正前方为 -Z）
  const angles = [-2.4, -1.9, -1.4, 1.4, 1.9, 2.4]
  return configs.map((c, i) => {
    const a = angles[i]
    const x = Math.sin(a) * R
    const z = -Math.cos(a) * R
    return {
      ...c,
      position: [x, 0, z] as [number, number, number],
      rotationY: Math.atan2(x, -z) + Math.PI, // 面向中心
    }
  })
}

export default function Bridge3DScene({
  criticals,
  warnings,
  running,
  clusters,
  okClusters,
  focusedConsole,
  onConsoleClick,
  lowPerf,
}: Props) {
  const consoles = useMemo(() => buildConsoles({ alerts: criticals + warnings, tasks: running }), [criticals, warnings, running])
  const focusTarget = useMemo<[number, number, number] | null>(() => {
    if (!focusedConsole) return null
    const c = consoles.find(x => x.id === focusedConsole)
    return c ? [c.position[0], 2, c.position[2]] : null
  }, [focusedConsole, consoles])

  return (
    <Canvas
      shadows={false}
      dpr={lowPerf ? [1, 1.2] : [1, 1.75]}
      camera={{ position: [0, 3, 6], fov: 60, near: 0.1, far: 200 }}
      gl={{ antialias: !lowPerf, powerPreference: 'high-performance', alpha: true }}
      style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, #0d0524 0%, #030510 60%, #000005 100%)' }}
    >
      {/* 全局环境光（低强度，避免盖过发光材质） */}
      <ambientLight intensity={0.15} color="#2a3f6a" />
      {/* 品红点光（玩家位下方） */}
      <pointLight position={[0, 1, 0]} intensity={2.5} color="#ff2d92" distance={12} />
      {/* 青色点光（主屏幕背后） */}
      <pointLight position={[0, 4, -6]} intensity={2} color="#4fc3f7" distance={20} />
      {/* 顶部补光 */}
      <pointLight position={[0, 15, 0]} intensity={0.3} color="#8ac6ff" distance={30} />

      <Suspense fallback={null}>
        <Starfield count={lowPerf ? 200 : 500} />
        <BridgeFloor />
        <BridgeWalls />
        <SideConsoles />
        <CaptainAvatar />
        <CenterBeam />
        {!lowPerf && <FloatingOrbs count={6} />}
        {consoles.map(c => (
          <ConsoleStation
            key={c.id}
            data={c}
            focused={focusedConsole === c.id}
            onClick={onConsoleClick}
          />
        ))}
        <MainScreen
          criticals={criticals}
          warnings={warnings}
          running={running}
          clusters={clusters}
          okClusters={okClusters}
        />
      </Suspense>

      <CameraRig focusTarget={focusTarget} />
      {!lowPerf && <Effects lowPerf={false} />}
    </Canvas>
  )
}
