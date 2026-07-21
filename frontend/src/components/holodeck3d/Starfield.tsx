import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 舰桥背景星空
 * 大量小 sprite 铺满球面，缓慢自转
 */
export default function Starfield({ count = 600 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // 均匀分布在半径 40 的球面
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 40 + Math.random() * 20
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.5 + 5 // 稍微压扁 + 上移
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

      const cyan = Math.random() > 0.75
      colors[i * 3] = cyan ? 0.3 : 1
      colors[i * 3 + 1] = cyan ? 0.75 : 1
      colors[i * 3 + 2] = 1
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [count])

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.005
  })

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.15} vertexColors transparent opacity={0.9} sizeAttenuation toneMapped={false} />
    </points>
  )
}
