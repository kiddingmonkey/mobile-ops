import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 舰长虚影（精细版）：
 * - 分层建模：斗篷主体（下摆宽）+ 上身（收腰）+ 肩甲 + 头盔 + 面罩
 * - 肩章双侧装饰
 * - PBR 金属材质
 * - 呼吸 + 微晃 + 面罩闪烁
 */
export default function CaptainAvatar() {
  const groupRef = useRef<THREE.Group>(null)
  const visorRef = useRef<THREE.Mesh>(null)
  const shoulderRingsRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (groupRef.current) {
      const s = 1 + Math.sin(t * 1.2) * 0.015
      groupRef.current.scale.y = s
      groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.05
    }
    if (visorRef.current) {
      const mat = visorRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.85 + Math.sin(t * 3) * 0.1
    }
    if (shoulderRingsRef.current) {
      shoulderRingsRef.current.rotation.z = Math.sin(t * 0.8) * 0.02
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 斗篷下摆（宽底） */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.95, 1.2, 8]} />
        <meshStandardMaterial
          color="#0a0e28"
          metalness={0.5}
          roughness={0.65}
          emissive="#2e1550"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* 斗篷腰部收窄 */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.75, 0.6, 8]} />
        <meshStandardMaterial
          color="#0f1230"
          metalness={0.6}
          roughness={0.55}
          emissive="#3a1a5a"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* 腰带 */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 0.12, 8]} />
        <meshStandardMaterial
          color="#050810"
          metalness={0.95}
          roughness={0.25}
          emissive="#ff2d92"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* 腰带扣（前方发光块） */}
      <mesh position={[0, 1.6, 0.55]}>
        <boxGeometry args={[0.2, 0.08, 0.06]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} />
      </mesh>

      {/* 胸甲 */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.6, 8]} />
        <meshStandardMaterial
          color="#0a0f28"
          metalness={0.85}
          roughness={0.3}
          emissive="#3a1a5a"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* 胸甲中央 V 型装饰 */}
      <mesh position={[0, 1.9, 0.5]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.08, 0.35, 3]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} />
      </mesh>

      {/* 肩甲（两侧） */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * 0.5, 2.15, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.22, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color="#050810"
              metalness={0.95}
              roughness={0.2}
              emissive="#ff2d92"
              emissiveIntensity={0.5}
            />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.15, 0.22, 20]} />
            <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* 肩章圆环装饰（浮动） */}
      <group ref={shoulderRingsRef} position={[0, 2.2, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.62, 0.68, 32]} />
          <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 颈部 */}
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 0.15, 8]} />
        <meshStandardMaterial color="#0a0f28" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* 头盔 */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial
          color="#050810"
          metalness={0.95}
          roughness={0.15}
          emissive="#4fc3f7"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* 头盔顶部装饰凸起 */}
      <mesh position={[0, 2.85, 0]}>
        <coneGeometry args={[0.08, 0.15, 6]} />
        <meshStandardMaterial color="#050810" metalness={0.95} roughness={0.15} />
      </mesh>

      {/* 面罩（青色发光弧带） */}
      <mesh ref={visorRef} position={[0, 2.62, 0.22]} rotation={[0.1, 0, 0]}>
        <planeGeometry args={[0.35, 0.1]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.9} />
      </mesh>

      {/* 面罩边框 */}
      <mesh position={[0, 2.62, 0.22]} rotation={[0.1, 0, 0]}>
        <planeGeometry args={[0.36, 0.12]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} wireframe transparent opacity={1} />
      </mesh>

      {/* 头盔侧面通气口 */}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * 0.25, 2.58, 0]} rotation={[0, 0, side * Math.PI / 4]}>
          <boxGeometry args={[0.02, 0.1, 0.06]} />
          <meshBasicMaterial color="#ff2d92" toneMapped={false} />
        </mesh>
      ))}

      {/* 头顶悬浮光柱 */}
      <mesh position={[0, 3.3, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 3.8, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} />
      </mesh>

      {/* 脚下光盘 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.6, 0.78, 32]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.15} />
      </mesh>
    </group>
  )
}
