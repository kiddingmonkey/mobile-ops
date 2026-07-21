import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'

/**
 * 舰桥地板（反射版）：
 * - MeshReflectorMaterial：真实的模糊反射，让霓虹灯在地板上倒影
 * - 圆形边界 + 同心圆网格 + 径向射线
 * - 中央玩家位发光圆环
 */
export default function BridgeFloor({ lowPerf = false }: { lowPerf?: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null)
  const outerRingRef = useRef<THREE.Mesh>(null)

  const gridLines = useMemo(() => {
    const lines: [number, number, number][][] = []
    for (let r = 2; r <= 12; r += 2) {
      const pts: [number, number, number][] = []
      const segs = 64
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2
        pts.push([Math.cos(a) * r, 0.02, Math.sin(a) * r])
      }
      lines.push(pts)
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      lines.push([
        [Math.cos(a) * 2, 0.02, Math.sin(a) * 2],
        [Math.cos(a) * 12, 0.02, Math.sin(a) * 12],
      ])
    }
    return lines
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.6 + Math.sin(t * 1.5) * 0.3
    }
    if (outerRingRef.current) {
      const mat = outerRingRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.6 + Math.sin(t * 0.8) * 0.25
    }
  })

  return (
    <group>
      {/* 主地板：反射材质 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[12, 64]} />
        {lowPerf ? (
          <meshStandardMaterial
            color="#05081a"
            metalness={0.9}
            roughness={0.4}
            emissive="#0a1030"
            emissiveIntensity={0.3}
          />
        ) : (
          <MeshReflectorMaterial
            blur={[200, 100]}
            resolution={512}
            mixBlur={1}
            mixStrength={20}
            depthScale={1}
            minDepthThreshold={0.85}
            color="#040614"
            metalness={0.9}
            roughness={0.4}
            mirror={0.35}
          />
        )}
      </mesh>

      {/* 玩家位内圈 */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.3, 1.6, 64]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.8, 0.95, 64]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>

      {/* 中央玩家位内十字装饰 */}
      {[0, Math.PI / 2].map((r, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, r]} position={[0, 0.04, 0]}>
          <boxGeometry args={[0.05, 1.4, 0.05]} />
          <meshBasicMaterial color="#4fc3f7" toneMapped={false} />
        </mesh>
      ))}

      {/* 网格线 */}
      {gridLines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry
            attach="geometry"
            onUpdate={(g: any) => {
              const arr = new Float32Array(pts.flat())
              g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
            }}
          />
          <lineBasicMaterial color="#4fc3f7" transparent opacity={0.28} toneMapped={false} />
        </line>
      ))}

      {/* 外圈边缘发光环（呼吸） */}
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[11.85, 12, 64]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* 6 个控制台脚下发光垫（增强空间感） */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angles = [-2.4, -1.9, -1.4, 1.4, 1.9, 2.4]
        const a = angles[i]
        const R = 5.5
        const x = Math.sin(a) * R
        const z = -Math.cos(a) * R
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.05, z]}>
            <ringGeometry args={[1.0, 1.15, 32]} />
            <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}
