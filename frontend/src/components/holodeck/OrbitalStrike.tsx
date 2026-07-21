import { useEffect, useState } from 'react'
import { hapticLight } from '@/utils/haptics'

/**
 * 轨道打击动画
 * 用于扩容/发布/关键操作的仪式反馈
 *
 * 使用：
 * const [strike, setStrike] = useState(false)
 * <OrbitalStrike active={strike} onDone={() => setStrike(false)} />
 * <button onClick={() => setStrike(true)}>扩容</button>
 */

export default function OrbitalStrike({
  active,
  x = 50, // 目标 X 百分比
  y = 50, // 目标 Y 百分比
  color = 'var(--hd-cyan)',
  glowColor = 'var(--hd-cyan-glow)',
  duration = 1400,
  onDone,
}: {
  active: boolean
  x?: number
  y?: number
  color?: string
  glowColor?: string
  duration?: number
  onDone?: () => void
}) {
  const [phase, setPhase] = useState<'idle' | 'strike'>('idle')

  useEffect(() => {
    if (!active) return
    setPhase('strike')
    hapticLight()
    // 二次触感（撞击）
    const t1 = setTimeout(() => hapticLight(), 600)
    const t2 = setTimeout(() => {
      setPhase('idle')
      onDone?.()
    }, duration)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [active, duration, onDone])

  if (phase === 'idle') return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9990,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* 全屏震动闪光 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at ${x}% ${y}%, ${glowColor} 0%, transparent 40%)`,
        animation: 'hd-strike-flash 0.4s ease-out',
        mixBlendMode: 'screen',
      }} />

      {/* 天降光柱 */}
      <div style={{
        position: 'absolute',
        left: `${x}%`,
        top: 0,
        bottom: `${100 - y}%`,
        width: 3,
        transform: 'translateX(-50%)',
        background: `linear-gradient(180deg, transparent 0%, ${color} 40%, #ffffff 90%, ${color} 100%)`,
        boxShadow: `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
        animation: 'hd-strike-beam 0.6s cubic-bezier(0.2, 0.9, 0.1, 1) forwards',
      }} />

      {/* 外圈光晕 */}
      <div style={{
        position: 'absolute',
        left: `${x}%`,
        top: 0,
        bottom: `${100 - y}%`,
        width: 40,
        transform: 'translateX(-50%)',
        background: `linear-gradient(180deg, transparent 0%, ${glowColor} 60%, ${color} 100%)`,
        filter: 'blur(8px)',
        opacity: 0.6,
        animation: 'hd-strike-beam 0.6s cubic-bezier(0.2, 0.9, 0.1, 1) forwards',
      }} />

      {/* 撞击点冲击波 */}
      <ImpactRipple x={x} y={y} color={color} glowColor={glowColor} />

      {/* 星系抖动罩 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        animation: 'hd-shake 0.5s ease-out 0.55s',
      }} />
    </div>
  )
}

function ImpactRipple({ x, y, color, glowColor }: { x: number; y: number; color: string; glowColor: string }) {
  return (
    <>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            boxShadow: `0 0 20px ${glowColor}`,
            opacity: 0,
            animation: `hd-ripple 1s cubic-bezier(0, 0.5, 0.3, 1) ${0.55 + i * 0.12}s forwards`,
          }}
        />
      ))}
      {/* 中心闪光 */}
      <div
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          transform: 'translate(-50%, -50%)',
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: `radial-gradient(circle, #ffffff 0%, ${color} 40%, transparent 70%)`,
          opacity: 0,
          animation: 'hd-impact-flash 0.4s ease-out 0.55s forwards',
        }}
      />
    </>
  )
}
