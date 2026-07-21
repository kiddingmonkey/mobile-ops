import { useRef, useState } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

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
 * 环绕舰桥的控制台：矮台 + 悬浮全息屏 + 图标 + 标签
 * focused 时会强化发光和上升动画
 */
export default function ConsoleStation({ data, onClick, focused }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const screenRef = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (screenRef.current) {
      // 呼吸
      const s = 1 + Math.sin(t * 1.5 + data.position[0]) * 0.03
      screenRef.current.scale.set(s, s, 1)
    }
    if (groupRef.current) {
      const targetY = focused ? 0.25 : hover ? 0.12 : 0
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.1
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick(data)
  }

  const emissiveStrong = focused || hover

  return (
    <group
      ref={groupRef}
      position={data.position}
      rotation={[0, data.rotationY, 0]}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
    >
      {/* 底座 */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.9, 1, 8]} />
        <meshStandardMaterial
          color="#0a1428"
          metalness={0.9}
          roughness={0.3}
          emissive={data.color}
          emissiveIntensity={emissiveStrong ? 0.6 : 0.2}
        />
      </mesh>

      {/* 底座顶面装饰环 */}
      <mesh position={[0, 1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.7, 24]} />
        <meshBasicMaterial color={data.color} toneMapped={false} transparent opacity={emissiveStrong ? 1 : 0.6} />
      </mesh>

      {/* 悬浮全息屏 */}
      <mesh ref={screenRef} position={[0, 2, 0]}>
        <planeGeometry args={[1.6, 1.2]} />
        <meshBasicMaterial
          color={data.color}
          toneMapped={false}
          transparent
          opacity={emissiveStrong ? 0.28 : 0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 全息屏边框（4 个角） */}
      {([[-0.75, 0.5], [0.75, 0.5], [-0.75, -0.5], [0.75, -0.5]] as [number, number][]).map(([x, y], i) => (
        <mesh key={i} position={[x, 2 + y, 0]}>
          <boxGeometry args={[0.1, 0.02, 0.02]} />
          <meshBasicMaterial color={data.color} toneMapped={false} />
        </mesh>
      ))}

      {/* HTML overlay: 图标 + 标签 */}
      <Html
        position={[0, 2, 0.01]}
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
          fontSize: 36,
          filter: emissiveStrong ? `drop-shadow(0 0 12px ${data.color})` : 'none',
          transition: 'filter 0.2s',
        }}>
          {data.icon}
        </div>
        <div style={{
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.25em',
          color: data.color,
          fontWeight: 700,
          marginTop: 4,
          textShadow: `0 0 8px ${data.color}`,
        }}>
          {data.labelEn}
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(220, 240, 255, 0.85)',
          letterSpacing: '0.15em',
          marginTop: 2,
        }}>
          {data.label}
        </div>
        {data.badge != null && data.badge !== 0 && data.badge !== '' && (
          <div style={{
            marginTop: 6,
            display: 'inline-block',
            padding: '2px 8px',
            background: 'rgba(255, 45, 146, 0.2)',
            border: '1px solid #ff2d92',
            color: '#ff2d92',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.1em',
            borderRadius: 2,
            textShadow: '0 0 6px #ff2d92',
          }}>
            {data.badge}
          </div>
        )}
      </Html>
    </group>
  )
}
