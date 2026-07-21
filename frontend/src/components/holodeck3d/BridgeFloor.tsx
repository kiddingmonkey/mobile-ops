import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * 圆形舰桥地板 + 青色霓虹网格
 * 地板半径 12，网格由多个同心圆 + 径向射线组成
 */
export default function BridgeFloor() {
  const gridLines = useMemo(() => {
    const lines: [number, number, number][][] = []
    // 同心圆
    for (let r = 2; r <= 12; r += 2) {
      const pts: [number, number, number][] = []
      const segs = 64
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2
        pts.push([Math.cos(a) * r, 0.01, Math.sin(a) * r])
      }
      lines.push(pts)
    }
    // 径向射线（12 条）
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      lines.push([
        [Math.cos(a) * 2, 0.01, Math.sin(a) * 2],
        [Math.cos(a) * 12, 0.01, Math.sin(a) * 12],
      ])
    }
    return lines
  }, [])

  return (
    <group>
      {/* 主地板 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[12, 64]} />
        <meshStandardMaterial
          color="#050818"
          metalness={0.85}
          roughness={0.35}
          emissive="#0a1030"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* 中央发光圆环（玩家位） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.3, 1.6, 64]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.8, 0.95, 64]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.65} />
      </mesh>

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
          <lineBasicMaterial color="#4fc3f7" transparent opacity={0.35} toneMapped={false} />
        </line>
      ))}

      {/* 外圈边缘发光环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[11.85, 12, 64]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}
