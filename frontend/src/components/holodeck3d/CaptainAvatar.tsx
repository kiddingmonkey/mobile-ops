import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 舰长虚影：站在玩家位（中央）
 * 用几何体拼出剪影：斗篷（圆锥）+ 头（球）+ 光晕
 * 缓慢呼吸 + 微微飘动，象征玩家的存在
 */
export default function CaptainAvatar() {
  const groupRef = useRef<THREE.Group>(null)
  const cloakRef = useRef<THREE.Mesh>(null)
  const headRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    // 呼吸
    const s = 1 + Math.sin(t * 1.2) * 0.02
    groupRef.current.scale.y = s
    // 微微左右晃动（像重心转移）
    groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.03
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 斗篷（下窄上宽的锥形） */}
      <mesh ref={cloakRef} position={[0, 1, 0]} castShadow>
        <coneGeometry args={[0.7, 2, 8]} />
        <meshStandardMaterial
          color="#08122a"
          metalness={0.4}
          roughness={0.7}
          emissive="#3a1a5a"
          emissiveIntensity={0.4}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* 肩甲光带 */}
      <mesh position={[0, 1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.5, 24]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* 头（暗色球） */}
      <mesh ref={headRef} position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial
          color="#050810"
          metalness={0.6}
          roughness={0.4}
          emissive="#4fc3f7"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* 面罩（青色发光弧） */}
      <mesh position={[0, 2.3, 0.15]}>
        <planeGeometry args={[0.3, 0.08]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.9} />
      </mesh>

      {/* 头顶光柱（弱） */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.6} />
      </mesh>

      {/* 脚下地板发光圆盘 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.6, 0.75, 32]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.8} />
      </mesh>
    </group>
  )
}
