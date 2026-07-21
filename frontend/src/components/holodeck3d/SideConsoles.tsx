import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 舰桥后侧的装饰性控制台阵列
 * 玩家背后 180° 有一排装饰控制台，营造"这是一个真的舰桥"感
 * 纯装饰，不可交互
 */
export default function SideConsoles() {
  const items = useMemo(() => {
    const arr: { x: number; z: number; ry: number; color: string; blinkRate: number }[] = []
    // 后方 5 个 + 两侧各 2 个
    for (let i = 0; i < 9; i++) {
      const angle = Math.PI / 2 + (Math.PI * i) / 8 // 90° 到 270°
      const r = 9.5
      arr.push({
        x: Math.sin(angle) * r,
        z: -Math.cos(angle) * r,
        ry: Math.atan2(Math.sin(angle), -Math.cos(angle)) + Math.PI,
        color: i % 3 === 0 ? '#ff2d92' : i % 3 === 1 ? '#4fc3f7' : '#a78bfa',
        blinkRate: 0.5 + Math.random() * 2,
      })
    }
    return arr
  }, [])

  return (
    <group>
      {items.map((item, i) => (
        <SideConsole key={i} data={item} />
      ))}
    </group>
  )
}

function SideConsole({ data }: { data: { x: number; z: number; ry: number; color: string; blinkRate: number } }) {
  const lightsRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!lightsRef.current) return
    const t = clock.getElapsedTime()
    lightsRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh
      const mat = mesh.material as THREE.MeshBasicMaterial
      const on = Math.sin(t * data.blinkRate + i) > 0
      mat.opacity = on ? 0.9 : 0.15
    })
  })

  return (
    <group position={[data.x, 0, data.z]} rotation={[0, data.ry, 0]}>
      {/* 桌面 */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1.2, 0.15, 0.6]} />
        <meshStandardMaterial
          color="#0a1428"
          metalness={0.9}
          roughness={0.3}
          emissive={data.color}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* 支柱 */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.15, 1, 0.15]} />
        <meshStandardMaterial color="#0a1428" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* 桌面上的指示灯（4 个闪烁） */}
      <group ref={lightsRef} position={[0, 1.11, 0]}>
        {[-0.4, -0.15, 0.15, 0.4].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <boxGeometry args={[0.08, 0.02, 0.08]} />
            <meshBasicMaterial color={data.color} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* 立式屏幕（倾斜） */}
      <mesh position={[0, 1.6, 0]} rotation={[-Math.PI / 12, 0, 0]}>
        <planeGeometry args={[1, 0.5]} />
        <meshBasicMaterial color={data.color} toneMapped={false} transparent opacity={0.25} />
      </mesh>
      {/* 屏幕边框 */}
      <mesh position={[0, 1.6, 0.01]} rotation={[-Math.PI / 12, 0, 0]}>
        <planeGeometry args={[1.05, 0.55]} />
        <meshBasicMaterial color={data.color} toneMapped={false} wireframe transparent opacity={0.6} />
      </mesh>
    </group>
  )
}
