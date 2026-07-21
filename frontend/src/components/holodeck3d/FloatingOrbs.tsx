import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 悬浮数据球
 * 舰桥内飘浮的全息数据节点，装饰性 + 空间感
 */
export default function FloatingOrbs({ count = 8 }: { count?: number }) {
  const groupRef = useRef<THREE.Group>(null)

  const orbs = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * 16,
      y: 2 + Math.random() * 6,
      z: (Math.random() - 0.5) * 16,
      radius: 0.08 + Math.random() * 0.1,
      color: Math.random() > 0.5 ? '#4fc3f7' : '#ff2d92',
      speed: 0.3 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    })), [count])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.children.forEach((child, i) => {
      const orb = orbs[i]
      if (!orb) return
      child.position.y = orb.y + Math.sin(t * orb.speed + orb.phase) * 0.3
      child.position.x = orb.x + Math.cos(t * orb.speed * 0.7 + orb.phase) * 0.2
    })
  })

  return (
    <group ref={groupRef}>
      {orbs.map((orb, i) => (
        <group key={i} position={[orb.x, orb.y, orb.z]}>
          <mesh>
            <sphereGeometry args={[orb.radius, 12, 12]} />
            <meshBasicMaterial color={orb.color} toneMapped={false} />
          </mesh>
          {/* 光晕环 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[orb.radius * 1.5, orb.radius * 2, 16]} />
            <meshBasicMaterial color={orb.color} toneMapped={false} transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
