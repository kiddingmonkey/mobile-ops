import { useMemo, useRef, useState } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { holoAudio } from '@/utils/holoAudio'

export interface ConsoleData {
  id: string
  label: string
  labelEn: string
  icon: string
  color: string
  badge?: number | string
  position: [number, number, number]
  rotationY: number
}

interface Props {
  data: ConsoleData
  onClick: (data: ConsoleData) => void
  focused: boolean
}

/**
 * 精细化控制台：
 * - 圆角底座 + 斜面顶盖 + 装饰凹槽
 * - PBR 金属材质（metalness/roughness/emissive）
 * - 全息屏悬浮 + 边框角标 + 扫描线
 * - 图标+双语标签+徽章
 */
export default function ConsoleStation({ data, onClick, focused }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const screenRef = useRef<THREE.Mesh>(null)
  const scanRef = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (screenRef.current) {
      const s = 1 + Math.sin(t * 1.5 + data.position[0]) * 0.02
      screenRef.current.scale.set(s, s, 1)
    }
    if (scanRef.current) {
      // 扫描线上下移动
      scanRef.current.position.y = 2 + Math.sin(t * 2 + data.position[0]) * 0.5
    }
    if (groupRef.current) {
      const targetY = focused ? 0.3 : hover ? 0.15 : 0
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.15
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    holoAudio.consoleClick()
    onClick(data)
  }

  const emissiveStrong = focused || hover
  const emissiveIntensity = emissiveStrong ? 1.2 : 0.5

  return (
    <group
      ref={groupRef}
      position={data.position}
      rotation={[0, data.rotationY, 0]}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); holoAudio.consoleHover(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
    >
      {/* 底座下缘装饰（大圆环） */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.15, 32]} />
        <meshBasicMaterial color={data.color} toneMapped={false} transparent opacity={emissiveStrong ? 0.9 : 0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* 主底座（圆角六边形柱） */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.9, 1.1, 6]} />
        <meshStandardMaterial
          color="#0a1428"
          metalness={0.95}
          roughness={0.25}
          emissive={data.color}
          emissiveIntensity={emissiveIntensity * 0.4}
        />
      </mesh>

      {/* 底座中部凹槽装饰（发光带） */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.78, 0.78, 0.08, 6]} />
        <meshBasicMaterial color={data.color} toneMapped={false} transparent opacity={emissiveStrong ? 1 : 0.7} />
      </mesh>

      {/* 顶盖（斜面平台） */}
      <mesh position={[0, 1.15, 0]} rotation={[0.15, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.75, 0.12, 6]} />
        <meshStandardMaterial
          color="#152238"
          metalness={0.9}
          roughness={0.35}
          emissive={data.color}
          emissiveIntensity={emissiveIntensity * 0.3}
        />
      </mesh>

      {/* 顶盖发光环 */}
      <mesh position={[0, 1.22, 0.05]} rotation={[-Math.PI / 2 + 0.15, 0, 0]}>
        <ringGeometry args={[0.5, 0.6, 24]} />
        <meshBasicMaterial color={data.color} toneMapped={false} transparent opacity={emissiveStrong ? 1 : 0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* 4 个装饰小指示灯 */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 0.45, 1.24, Math.sin(a) * 0.45]}
        >
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={data.color} toneMapped={false} />
        </mesh>
      ))}

      {/* 全息屏支柱（细金属杆） */}
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.7, 6]} />
        <meshStandardMaterial color="#0a1428" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* 悬浮全息屏（主体） */}
      <mesh ref={screenRef} position={[0, 2.2, 0]}>
        <planeGeometry args={[1.7, 1.3]} />
        <meshBasicMaterial
          color={data.color}
          toneMapped={false}
          transparent
          opacity={emissiveStrong ? 0.35 : 0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 全息屏外框 */}
      <mesh position={[0, 2.2, -0.01]}>
        <planeGeometry args={[1.75, 1.35]} />
        <meshBasicMaterial color={data.color} toneMapped={false} transparent opacity={emissiveStrong ? 1 : 0.7} wireframe />
      </mesh>

      {/* 全息屏扫描线（上下扫过） */}
      <mesh ref={scanRef} position={[0, 2, 0.01]}>
        <planeGeometry args={[1.65, 0.04]} />
        <meshBasicMaterial color={data.color} toneMapped={false} transparent opacity={0.5} />
      </mesh>

      {/* 4 个角标 */}
      {([[-0.8, 0.6], [0.8, 0.6], [-0.8, -0.6], [0.8, -0.6]] as [number, number][]).map(([x, y], i) => (
        <group key={i} position={[x, 2.2 + y, 0]}>
          <mesh>
            <boxGeometry args={[0.15, 0.03, 0.03]} />
            <meshBasicMaterial color={data.color} toneMapped={false} />
          </mesh>
          <mesh position={[y > 0 ? -0.06 : 0.06, y > 0 ? -0.06 : 0.06, 0]}>
            <boxGeometry args={[0.03, 0.15, 0.03]} />
            <meshBasicMaterial color={data.color} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* HTML: 图标 + 标签 + 徽章 */}
      <Html
        position={[0, 2.2, 0.05]}
        center
        distanceFactor={8}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          width: 200,
          textAlign: 'center',
        }}
      >
        <div style={{
          fontSize: 44,
          filter: emissiveStrong ? `drop-shadow(0 0 16px ${data.color})` : `drop-shadow(0 0 6px ${data.color}80)`,
          transition: 'filter 0.2s',
          lineHeight: 1,
        }}>
          {data.icon}
        </div>
        <div style={{
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.3em',
          color: data.color,
          fontWeight: 700,
          marginTop: 6,
          textShadow: `0 0 10px ${data.color}`,
        }}>
          {data.labelEn}
        </div>
        <div style={{
          fontSize: 11,
          color: 'rgba(220,240,255,0.9)',
          letterSpacing: '0.2em',
          marginTop: 3,
          textShadow: `0 0 4px ${data.color}`,
        }}>
          {data.label}
        </div>
        {data.badge != null && data.badge !== 0 && data.badge !== '' && (
          <div style={{
            marginTop: 8,
            display: 'inline-block',
            padding: '3px 10px',
            background: 'rgba(255, 45, 146, 0.25)',
            border: '1px solid #ff2d92',
            color: '#ff2d92',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: '0.1em',
            borderRadius: 2,
            textShadow: '0 0 8px #ff2d92',
            fontWeight: 700,
          }}>
            {data.badge}
          </div>
        )}
      </Html>
    </group>
  )
}
