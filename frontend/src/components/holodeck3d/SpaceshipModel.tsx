import { useGLTF } from '@react-three/drei'
import { useEffect } from 'react'
import * as THREE from 'three'

/**
 * 加载 Sketchfab 飞船模型作为舰桥主体
 * 模型：Spaceship by JazOone (CC-BY)
 * 来源：https://sketchfab.com/3d-models/spaceship-6164a883f57f4f13938c3c5999bc0e1f
 */
export default function SpaceshipModel({ visible = true }: { visible?: boolean }) {
  const { scene } = useGLTF('/models/spaceship.glb')

  useEffect(() => {
    // 遍历模型所有材质，大幅增强发光和亮度
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (mat.isMeshStandardMaterial) {
          // 强化亮度：降低粗糙度，提高金属感，增加自发光
          mat.metalness = 0.85
          mat.roughness = 0.25
          mat.emissive = new THREE.Color(0x4fc3f7)
          mat.emissiveIntensity = 0.2
          mat.needsUpdate = true
        }
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
  }, [scene])

  return (
    <primitive
      object={scene}
      position={[0, -2, 0]}
      rotation={[0, Math.PI, 0]}
      scale={3}
      visible={visible}
    />
  )
}

// 预加载模型
useGLTF.preload('/models/spaceship.glb')
