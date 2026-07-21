import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface Props {
  criticals: number
  warnings: number
  running: number
  clusters: number
  okClusters: number
}

/**
 * 正前方巨型主屏幕
 * 用平面 + 边角装饰代替 wireframe 柱面，避免遮挡内容
 */
export default function MainScreen({ criticals, warnings, running, clusters, okClusters }: Props) {
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (glowRef.current) {
      const s = 1 + Math.sin(t * 0.6) * 0.015
      glowRef.current.scale.set(s, s, 1)
    }
  })

  const combat = criticals > 0
  const primaryColor = combat ? '#ff3b5c' : '#4fc3f7'
  const glowColor = combat ? 'rgba(255,59,92,0.5)' : 'rgba(79,195,247,0.5)'

  // 屏幕放在正前方 z=-9，高度 y=4，尺寸 14x6
  const W = 14
  const H = 6
  const zPos = -9

  return (
    <group position={[0, 4, zPos]}>
      {/* 屏幕背光晕 */}
      <mesh ref={glowRef} position={[0, 0, -0.2]}>
        <planeGeometry args={[W + 2, H + 2]} />
        <meshBasicMaterial color={primaryColor} toneMapped={false} transparent opacity={0.08} />
      </mesh>

      {/* 屏幕主体（暗色玻璃） */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color="#030818" transparent opacity={0.75} />
      </mesh>

      {/* 边框描边（顶+底+左+右） */}
      <BorderLine start={[-W / 2, H / 2, 0]} end={[W / 2, H / 2, 0]} color={primaryColor} />
      <BorderLine start={[-W / 2, -H / 2, 0]} end={[W / 2, -H / 2, 0]} color={primaryColor} />
      <BorderLine start={[-W / 2, -H / 2, 0]} end={[-W / 2, H / 2, 0]} color={primaryColor} />
      <BorderLine start={[W / 2, -H / 2, 0]} end={[W / 2, H / 2, 0]} color={primaryColor} />

      {/* 四角装饰 */}
      <CornerBracket position={[-W / 2, H / 2, 0]} color={primaryColor} rotation={0} />
      <CornerBracket position={[W / 2, H / 2, 0]} color={primaryColor} rotation={Math.PI / 2} />
      <CornerBracket position={[W / 2, -H / 2, 0]} color={primaryColor} rotation={Math.PI} />
      <CornerBracket position={[-W / 2, -H / 2, 0]} color={primaryColor} rotation={-Math.PI / 2} />

      {/* HTML 数据面板（贴在屏幕表面，不占用 3D 空间）*/}
      <Html
        position={[0, 0, 0.05]}
        transform
        occlude={false}
        distanceFactor={3.2}
        style={{
          width: 1200,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{
          padding: '24px 30px',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#eaf4ff',
          textShadow: `0 0 8px ${primaryColor}`,
        }}>
          {/* 标题栏 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            paddingBottom: 14,
            borderBottom: `1px solid ${primaryColor}80`,
          }}>
            <div style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '0.35em',
              color: primaryColor,
            }}>
              ◆ GALAXY OVERVIEW · 星系总览
            </div>
            <div style={{
              fontSize: 16,
              color: primaryColor,
              letterSpacing: '0.25em',
              fontWeight: 700,
            }}>
              {combat ? '⚠ RED ALERT' : warnings > 0 ? '△ CAUTION' : '● NOMINAL'}
            </div>
          </div>

          {/* 5 项数据 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            <StatBlock label="CLUSTERS · 集群" value={clusters} color="#4fc3f7" />
            <StatBlock label="CRITICAL · 紧急" value={criticals} color="#ff3b5c" pulse={criticals > 0} />
            <StatBlock label="WARNING · 告警" value={warnings} color="#fbbf24" />
            <StatBlock label="OPS RUN · 任务" value={running} color="#a78bfa" />
            <StatBlock label="OK · 健康" value={`${okClusters}/${clusters}`} color="#4ade80" />
          </div>

          {/* 底部信息 */}
          <div style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: `1px solid ${primaryColor}60`,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            letterSpacing: '0.4em',
            color: `${primaryColor}b0`,
          }}>
            <span>▸ STARDECK · 全息舰桥指挥中心</span>
            <span>SYSTEM v16.3 · UPLINK OK ◂</span>
          </div>
        </div>
      </Html>
    </group>
  )
}

function BorderLine({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...start),
    new THREE.Vector3(...end),
  ])
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={color} toneMapped={false} linewidth={2} />
    </line>
  )
}

function CornerBracket({ position, color, rotation }: { position: [number, number, number]; color: string; rotation: number }) {
  return (
    <group position={position} rotation={[0, 0, rotation]}>
      <mesh position={[-0.3, 0, 0.05]}>
        <boxGeometry args={[0.6, 0.06, 0.06]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.3, 0.05]}>
        <boxGeometry args={[0.06, 0.6, 0.06]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

function StatBlock({ label, value, color, pulse }: { label: string; value: number | string; color: string; pulse?: boolean }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '18px 12px',
      background: `${color}12`,
      border: `1px solid ${color}70`,
      borderRadius: 6,
      animation: pulse ? 'hd-breathe 0.8s ease-in-out infinite' : undefined,
    }}>
      <div style={{
        fontSize: 44,
        fontWeight: 700,
        color,
        textShadow: `0 0 20px ${color}`,
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 12,
        color: `${color}dd`,
        letterSpacing: '0.2em',
        marginTop: 10,
      }}>
        {label}
      </div>
    </div>
  )
}
