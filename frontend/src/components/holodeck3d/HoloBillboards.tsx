import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

/**
 * 舰桥内部悬浮的科技感面板：
 * - 左右两侧漂浮 8 块半透明屏幕（模仿钢铁侠 Jarvis 界面）
 * - 每块显示不同的实时数据/波形/日志
 * - 缓慢起伏 + 随视角旋转
 */

const PANELS = [
  { pos: [-9, 5, -2] as [number, number, number], title: 'CPU LOAD', color: '#4fc3f7', type: 'wave' },
  { pos: [-9, 5.5, 2] as [number, number, number], title: 'MEM USAGE', color: '#a78bfa', type: 'bars' },
  { pos: [-9, 4.5, 6] as [number, number, number], title: 'NETWORK I/O', color: '#4ade80', type: 'wave' },
  { pos: [-9, 6, -5] as [number, number, number], title: 'PODS', color: '#fbbf24', type: 'grid' },
  { pos: [9, 5, -2] as [number, number, number], title: 'REQUESTS/s', color: '#00e5ff', type: 'wave' },
  { pos: [9, 5.5, 2] as [number, number, number], title: 'LATENCY p99', color: '#ff2d92', type: 'bars' },
  { pos: [9, 4.5, 6] as [number, number, number], title: 'ERRORS', color: '#ff3b5c', type: 'grid' },
  { pos: [9, 6, -5] as [number, number, number], title: 'UPTIME', color: '#94a3b8', type: 'text' },
]

export default function HoloBillboards() {
  return (
    <group>
      {PANELS.map((p, i) => (
        <HoloBillboard key={i} data={p} delay={i * 0.3} />
      ))}
    </group>
  )
}

function HoloBillboard({ data, delay }: { data: typeof PANELS[0]; delay: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const scanRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (groupRef.current) {
      groupRef.current.position.y = data.pos[1] + Math.sin(t * 0.6 + delay) * 0.15
      // 面板始终面向舰桥中心
      groupRef.current.lookAt(new THREE.Vector3(0, 3, 0))
    }
    if (scanRef.current) {
      scanRef.current.position.y = Math.sin(t * 1.5 + delay) * 0.4
    }
  })

  const isLeftSide = data.pos[0] < 0

  return (
    <group ref={groupRef} position={data.pos}>
      {/* 面板背景 */}
      <mesh>
        <planeGeometry args={[1.6, 1]} />
        <meshBasicMaterial color="#020614" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>

      {/* 边框 */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[1.65, 1.05]} />
        <meshBasicMaterial color={data.color} toneMapped={false} wireframe transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* 扫描线 */}
      <mesh ref={scanRef} position={[0, 0, 0.005]}>
        <planeGeometry args={[1.5, 0.03]} />
        <meshBasicMaterial color={data.color} toneMapped={false} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* 四角 */}
      {([[-0.75, 0.45], [0.75, 0.45], [-0.75, -0.45], [0.75, -0.45]] as [number, number][]).map(([x, y], i) => (
        <group key={i} position={[x, y, 0.01]}>
          <mesh>
            <boxGeometry args={[0.12, 0.02, 0.01]} />
            <meshBasicMaterial color={data.color} toneMapped={false} />
          </mesh>
          <mesh position={[y > 0 ? -0.05 : 0.05, y > 0 ? -0.05 : 0.05, 0]}>
            <boxGeometry args={[0.02, 0.12, 0.01]} />
            <meshBasicMaterial color={data.color} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* HTML 内容 */}
      <Html
        position={[0, 0, 0.02]}
        transform
        distanceFactor={4.5}
        style={{
          width: 240,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{
          padding: 8,
          fontFamily: "'JetBrains Mono', monospace",
          color: data.color,
          textShadow: `0 0 6px ${data.color}`,
        }}>
          <div style={{
            fontSize: 11,
            letterSpacing: '0.25em',
            fontWeight: 700,
            marginBottom: 6,
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>◆ {data.title}</span>
            <span style={{ opacity: 0.6 }}>{isLeftSide ? 'L' : 'R'}</span>
          </div>
          <MiniViz type={data.type} color={data.color} />
        </div>
      </Html>
    </group>
  )
}

function MiniViz({ type, color }: { type: string; color: string }) {
  if (type === 'wave') {
    return (
      <svg viewBox="0 0 240 90" style={{ width: '100%' }}>
        <path
          d="M 0 45 Q 20 15, 40 40 T 80 35 T 120 50 T 160 25 T 200 55 T 240 40"
          stroke={color}
          strokeWidth="2"
          fill="none"
          opacity="0.9"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
        <path
          d="M 0 60 Q 20 30, 40 55 T 80 50 T 120 65 T 160 40 T 200 70 T 240 55"
          stroke={color}
          strokeWidth="1"
          fill="none"
          opacity="0.4"
        />
      </svg>
    )
  }
  if (type === 'bars') {
    return (
      <div style={{ display: 'flex', gap: 3, height: 60, alignItems: 'flex-end' }}>
        {[45, 78, 32, 90, 65, 55, 82, 40, 70, 88, 50, 72].map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              background: color,
              boxShadow: `0 0 6px ${color}`,
              opacity: 0.85,
            }}
          />
        ))}
      </div>
    )
  }
  if (type === 'grid') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
        {Array.from({ length: 32 }).map((_, i) => (
          <div
            key={i}
            style={{
              aspectRatio: '1',
              background: Math.random() > 0.3 ? color : 'transparent',
              border: `1px solid ${color}80`,
              opacity: Math.random() > 0.5 ? 0.9 : 0.3,
            }}
          />
        ))}
      </div>
    )
  }
  // text
  return (
    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.1em', textAlign: 'center', padding: '10px 0' }}>
      99.98%
      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, letterSpacing: '0.2em' }}>
        30 DAYS
      </div>
    </div>
  )
}
