import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 玩家位中央十字光柱
 * 品红色，缓慢旋转+呼吸
 */
export default function CenterBeam() {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.y = t * 0.15
    const s = 1 + Math.sin(t * 1.2) * 0.05
    ref.current.scale.set(s, 1, s)
  })

  return (
    <group ref={ref} position={[0, 0, 0]}>
      {/* 主光柱 */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.05, 0.15, 8, 8, 1, true]} />
        <meshBasicMaterial
          color="#ff2d92"
          toneMapped={false}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 内芯 */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.02, 0.04, 8, 6]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* 顶部光点 */}
      <mesh position={[0, 8, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} />
      </mesh>
    </group>
  )
}
