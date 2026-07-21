import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface Props {
  focusTarget: [number, number, number] | null
  cameraPreset: CameraPreset
}

export type CameraPreset = 'overview' | 'captain' | 'front' | 'orbit' | 'top'

const PRESETS: Record<CameraPreset, { pos: [number, number, number]; look: [number, number, number] }> = {
  overview: { pos: [0, 8, 12], look: [0, 2, 0] },      // 舰桥全景（更高更远）
  captain: { pos: [0, 2, 3], look: [0, 2, -5] },       // 舰长背后看前方
  front: { pos: [0, 3, -8], look: [0, 3, 0] },         // 主屏幕正面
  orbit: { pos: [10, 5, 8], look: [0, 2, 0] },         // 侧面环绕
  top: { pos: [0, 15, 5], look: [0, 0, 0] },           // 俯视
}

/**
 * 灵活的相机系统：
 * - OrbitControls：单指转、双指缩放、双指平移，惯性阻尼流畅
 * - 5 个预设视角快速切换
 * - focusTarget：点击控制台时相机推近
 */
export default function CameraRig({ focusTarget, cameraPreset }: Props) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)
  const targetPos = useRef(new THREE.Vector3())
  const targetLook = useRef(new THREE.Vector3())
  const animatingRef = useRef(false)
  const animStart = useRef(0)

  // 初始位置
  useEffect(() => {
    const p = PRESETS.overview
    camera.position.set(...p.pos)
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      (camera as THREE.PerspectiveCamera).fov = 50
      camera.updateProjectionMatrix()
    }
    if (controlsRef.current) controlsRef.current.target.set(...p.look)
  }, [camera])

  // 预设切换动画
  useEffect(() => {
    const p = PRESETS[cameraPreset]
    targetPos.current.set(...p.pos)
    targetLook.current.set(...p.look)
    animatingRef.current = true
    animStart.current = performance.now()
  }, [cameraPreset])

  // 聚焦目标（点击控制台）
  useEffect(() => {
    if (!focusTarget) return
    const [tx, ty, tz] = focusTarget
    // 相机推到目标与中心的连线上，距离目标 2.5m
    const target = new THREE.Vector3(tx, ty, tz)
    const dir = target.clone().sub(new THREE.Vector3(0, 3, 0)).normalize()
    targetPos.current.copy(target).add(dir.multiplyScalar(2.5))
    targetPos.current.y = ty + 0.6
    targetLook.current.set(tx, ty - 0.3, tz)
    animatingRef.current = true
    animStart.current = performance.now()
  }, [focusTarget])

  useFrame(() => {
    if (!animatingRef.current || !controlsRef.current) return
    // 500ms 缓动动画
    const elapsed = performance.now() - animStart.current
    const t = Math.min(1, elapsed / 500)
    const ease = 1 - Math.pow(1 - t, 3) // easeOutCubic

    camera.position.lerp(targetPos.current, ease * 0.15)
    controlsRef.current.target.lerp(targetLook.current, ease * 0.15)
    controlsRef.current.update()

    if (t >= 1 && camera.position.distanceTo(targetPos.current) < 0.05) {
      animatingRef.current = false
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableZoom
      enableRotate
      enableDamping
      dampingFactor={0.15}
      panSpeed={0.8}
      rotateSpeed={1.2}
      zoomSpeed={1.2}
      minDistance={2}
      maxDistance={20}
      minPolarAngle={Math.PI * 0.15}
      maxPolarAngle={Math.PI * 0.5}
      target={[0, 3, -3]}
      // 触摸手势
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      // 鼠标手势
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  )
}
