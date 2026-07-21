import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * 舰桥围墙 + 天花板
 * 半开放的圆形舰桥：
 * - 后方 180° 有围墙（挡住玩家背后，营造"内部"感）
 * - 前方 180° 是主屏幕方向，保持开放
 * - 顶部有一圈发光穹顶环
 */
export default function BridgeWalls() {
  // 后方围墙：用 12 根发光柱子代替连续墙
  const pillars = useMemo(() => {
    const arr: { pos: [number, number, number]; height: number }[] = []
    // 从 -180° 到 -30° 和 30° 到 180°（避开正前方的主屏幕）
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI / 12) * i + Math.PI / 3 // 60° 到 180°
      const x = Math.sin(angle) * 11.8
      const z = -Math.cos(angle) * 11.8
      arr.push({ pos: [x, 0, z] as [number, number, number], height: 6 })
      // 对称的另一侧
      arr.push({ pos: [-x, 0, z] as [number, number, number], height: 6 })
    }
    return arr
  }, [])

  // 顶部环形装饰
  const domeLines = useMemo(() => {
    const lines: [number, number, number][][] = []
    // 天花板圆环（多层）
    for (let r = 4; r <= 12; r += 2) {
      const pts: [number, number, number][] = []
      const segs = 48
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2
        pts.push([Math.cos(a) * r, 10, Math.sin(a) * r])
      }
      lines.push(pts)
    }
    // 从地面到天花板的斜梁（8 条）
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      lines.push([
        [Math.cos(a) * 12, 0, Math.sin(a) * 12],
        [Math.cos(a) * 4, 10, Math.sin(a) * 4],
      ])
    }
    return lines
  }, [])

  return (
    <group>
      {/* 后方发光柱子 */}
      {pillars.map((p, i) => (
        <group key={i} position={p.pos}>
          <mesh position={[0, p.height / 2, 0]}>
            <cylinderGeometry args={[0.08, 0.12, p.height, 6]} />
            <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.7} />
          </mesh>
          {/* 柱子顶端光球 */}
          <mesh position={[0, p.height, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#4fc3f7" toneMapped={false} />
          </mesh>
          {/* 柱子底座 */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.25, 0.35, 0.4, 8]} />
            <meshStandardMaterial
              color="#0a1428"
              metalness={0.9}
              roughness={0.3}
              emissive="#4fc3f7"
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      ))}

      {/* 天花板装饰线条 */}
      {domeLines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry
            attach="geometry"
            onUpdate={(g: any) => {
              const arr = new Float32Array(pts.flat())
              g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
            }}
          />
          <lineBasicMaterial color="#4fc3f7" transparent opacity={0.25} toneMapped={false} />
        </line>
      ))}

      {/* 中央顶部悬浮光源 */}
      <mesh position={[0, 10, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} />
      </mesh>
      <mesh position={[0, 10, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.8, 32]} />
        <meshBasicMaterial color="#ff2d92" toneMapped={false} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
