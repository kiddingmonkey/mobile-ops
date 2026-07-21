import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface Props {
  focusTarget: [number, number, number] | null
}

/**
 * 相机控制：默认站在中央玩家位视角
 * - 单指拖动：水平旋转（yaw） + 上下俯仰（pitch，有限）
 * - 双指捏合：缩放 fov 或调整距离
 * - focusTarget 有值时相机平滑推近目标
 */
export default function CameraRig({ focusTarget }: Props) {
  const { camera, gl } = useThree()
  const yawRef = useRef(0)
  const pitchRef = useRef(-0.05)
  const distRef = useRef(6)
  const focusRef = useRef<[number, number, number] | null>(null)

  useEffect(() => {
    focusRef.current = focusTarget
  }, [focusTarget])

  useEffect(() => {
    // 初始位置：站在中央偏后，看向主屏幕
    camera.position.set(0, 3, 6)
    camera.lookAt(0, 3, -8)
  }, [camera])

  useEffect(() => {
    const el = gl.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0
    let pinchDist = 0

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      el.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      yawRef.current -= dx * 0.005
      pitchRef.current = Math.max(-0.6, Math.min(0.5, pitchRef.current - dy * 0.004))
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      try { el.releasePointerCapture(e.pointerId) } catch {}
    }

    // 触摸捏合
    let touches: TouchList | null = null
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touches = e.touches
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchDist = Math.hypot(dx, dy)
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touches) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const d = Math.hypot(dx, dy)
        const scale = d / pinchDist
        distRef.current = Math.max(3, Math.min(12, distRef.current / scale))
        pinchDist = d
      }
    }

    // 滚轮
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      distRef.current = Math.max(3, Math.min(12, distRef.current + e.deltaY * 0.01))
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  const tmp = useRef(new THREE.Vector3())
  useFrame(() => {
    // 目标位置：绕玩家位（0,3,0）的球面
    const [tx, ty, tz] = focusRef.current || [0, 3, 0]
    const targetLook = tmp.current.set(tx, ty, tz)

    // 如果聚焦目标，把相机拉近到目标
    let px: number, py: number, pz: number
    if (focusRef.current) {
      const dir = new THREE.Vector3(0, 0, 0).sub(targetLook).normalize()
      px = tx + dir.x * 2.5
      py = ty + 0.8
      pz = tz + dir.z * 2.5
    } else {
      const d = distRef.current
      px = Math.sin(yawRef.current) * d
      py = 3 + Math.sin(pitchRef.current) * d * 0.5
      pz = Math.cos(yawRef.current) * d
    }

    camera.position.lerp(new THREE.Vector3(px, py, pz), 0.08)
    camera.lookAt(targetLook)
  })

  return null
}
