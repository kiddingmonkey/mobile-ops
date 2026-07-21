import { useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 舰长立绘（2D 贴片，永远面向相机）
 * 图片：银发蓝眼女性 + 蓝龙（动漫风格）
 * Billboard 效果：自动旋转面向相机
 */
export default function CaptainBillboard() {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useLoader(THREE.TextureLoader, '/images/captain.png')

  useFrame(({ camera }) => {
    if (meshRef.current) {
      // 始终面向相机
      meshRef.current.lookAt(camera.position)
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* 立绘主体 */}
      <mesh ref={meshRef} position={[0, 1.8, 0]}>
        <planeGeometry args={[2.5, 3.6]} />
        <meshBasicMaterial
          map={texture}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 脚下光环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.2, 1.4, 32]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshBasicMaterial color="#4fc3f7" toneMapped={false} transparent opacity={0.15} />
      </mesh>
    </group>
  )
}
