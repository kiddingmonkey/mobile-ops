import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
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
import HoloBillboards from './HoloBillboards'

import type { CameraPreset } from './CameraRig'

interface Props {
  criticals: number
  warnings: number
  running: number
  clusters: number
  okClusters: number
  focusedConsole: string | null
  onConsoleClick: (data: ConsoleData) => void
  lowPerf?: boolean
  cameraPreset: CameraPreset
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
  cameraPreset,
}: Props) {
  const consoles = useMemo(() => buildConsoles({ alerts: criticals + warnings, tasks: running }), [criticals, warnings, running])
  const focusTarget = useMemo<[number, number, number] | null>(() => {
    if (!focusedConsole) return null
    const c = consoles.find(x => x.id === focusedConsole)
    return c ? [c.position[0], 2, c.position[2]] : null
  }, [focusedConsole, consoles])

  return (
    <Canvas
      shadows={!lowPerf}
      dpr={lowPerf ? [1, 1.2] : [1, 2]}
      camera={{ position: [0, 5, 9], fov: 55, near: 0.1, far: 200 }}
      gl={{
        antialias: !lowPerf,
        powerPreference: 'high-performance',
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, #1a0842 0%, #060316 55%, #000005 100%)' }}
    >
      {/* HDR 环境光：night preset 提供夜晚都市反射 */}
      <Suspense fallback={null}>
        <Environment preset="night" background={false} environmentIntensity={0.35} />
      </Suspense>

      {/* 关键补光：三点布光营造电影感 */}
      <ambientLight intensity={0.08} color="#3a2f6a" />

      {/* 主光：舰长头顶暖粉光 */}
      <spotLight
        position={[0, 8, 2]}
        angle={0.6}
        penumbra={0.8}
        intensity={3}
        color="#ff5da8"
        distance={20}
        castShadow={!lowPerf}
        shadow-mapSize={lowPerf ? 512 : 1024}
      />

      {/* 主屏幕补光：青色 */}
      <spotLight
        position={[0, 6, -6]}
        angle={0.9}
        penumbra={1}
        intensity={2.5}
        color="#4fc3f7"
        distance={25}
        target-position={[0, 3, 0]}
      />

      {/* 侧光：左右两侧品紫补光 */}
      <pointLight position={[-8, 3, 0]} intensity={1.2} color="#a78bfa" distance={14} decay={2} />
      <pointLight position={[8, 3, 0]} intensity={1.2} color="#a78bfa" distance={14} decay={2} />

      {/* 顶部体积光（模拟穹顶光） */}
      <pointLight position={[0, 12, 0]} intensity={0.5} color="#8ac6ff" distance={20} />

      {/* 地板接触阴影 */}
      {!lowPerf && (
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.55}
          scale={22}
          blur={2.5}
          far={4}
          color="#000000"
        />
      )}

      <Suspense fallback={null}>
        <Starfield count={lowPerf ? 200 : 600} />
        <BridgeFloor lowPerf={lowPerf} />
        <BridgeWalls />
        <SideConsoles />
        <CaptainAvatar />
        <CenterBeam />
        {!lowPerf && <FloatingOrbs count={6} />}
        <HoloBillboards />
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

      <CameraRig focusTarget={focusTarget} cameraPreset={cameraPreset} />
      {!lowPerf && <Effects lowPerf={false} />}
    </Canvas>
  )
}
