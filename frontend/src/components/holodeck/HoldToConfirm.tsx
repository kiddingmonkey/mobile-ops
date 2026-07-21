import { useCallback, useEffect, useRef, useState } from 'react'
import { hapticLight } from '@/utils/haptics'

/**
 * 长按蓄力确认组件
 * 用于关键操作（处理告警、执行扩容），长按 duration 毫秒后触发 onConfirm
 * 中途松开则重置，提供仪式感 + 防误触
 */
export default function HoldToConfirm({
  label = 'HOLD TO EXECUTE',
  duration = 1600,
  color = 'var(--hd-cyan)',
  glowColor = 'var(--hd-cyan-glow)',
  onConfirm,
  disabled = false,
  fullWidth = false,
}: {
  label?: string
  duration?: number
  color?: string
  glowColor?: string
  onConfirm: () => void
  disabled?: boolean
  fullWidth?: boolean
}) {
  const [progress, setProgress] = useState(0)
  const [charging, setCharging] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const doneRef = useRef(false)

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setCharging(false)
    if (!doneRef.current) setProgress(0)
  }, [])

  useEffect(() => () => stop(), [stop])

  const start = useCallback(() => {
    if (disabled || doneRef.current) return
    setCharging(true)
    startRef.current = performance.now()
    hapticLight()

    const tick = () => {
      const elapsed = performance.now() - startRef.current
      const p = Math.min(1, elapsed / duration)
      setProgress(p)
      if (p >= 1) {
        doneRef.current = true
        setCharging(false)
        onConfirm()
        // 完成动画后重置
        setTimeout(() => {
          doneRef.current = false
          setProgress(0)
        }, 800)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [disabled, duration, onConfirm])

  const size = 100
  const strokeWidth = 3
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - progress)
  const complete = progress >= 1

  return (
    <div
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      style={{
        position: 'relative',
        width: fullWidth ? '100%' : size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{
          width: size,
          height: size,
          transform: 'rotate(-90deg)',
          filter: charging || complete ? `drop-shadow(0 0 12px ${glowColor})` : 'none',
          transition: 'filter 0.2s ease',
        }}
      >
        {/* 底圈 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          opacity="0.15"
        />
        {/* 进度环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: charging ? 'none' : 'stroke-dashoffset 0.3s ease-out',
          }}
        />
        {/* 内部装饰刻度 */}
        {[0, 90, 180, 270].map(deg => (
          <line
            key={deg}
            x1={size / 2 + Math.cos((deg * Math.PI) / 180) * (r - 2)}
            y1={size / 2 + Math.sin((deg * Math.PI) / 180) * (r - 2)}
            x2={size / 2 + Math.cos((deg * Math.PI) / 180) * (r + 4)}
            y2={size / 2 + Math.sin((deg * Math.PI) / 180) * (r + 4)}
            stroke={color}
            strokeWidth="1.5"
            opacity="0.4"
          />
        ))}
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
        pointerEvents: 'none',
      }}>
        <div
          className="hd-text-mono"
          style={{
            fontSize: 9,
            color,
            letterSpacing: '0.2em',
            textShadow: charging ? `0 0 8px ${glowColor}` : 'none',
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {complete ? 'DONE' : charging ? 'CHARGING' : label}
        </div>
        {charging && (
          <div className="hd-text-mono" style={{ fontSize: 11, color, fontWeight: 700 }}>
            {Math.round(progress * 100)}%
          </div>
        )}
      </div>
    </div>
  )
}
