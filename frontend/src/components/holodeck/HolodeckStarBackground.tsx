import { useMemo, useEffect, useState } from 'react'

const STAR_COUNT = 80

export default function HolodeckStarBackground() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const stars = useMemo(() =>
    Array.from({ length: STAR_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: 1 + Math.random() * 2,
      duration: 2 + Math.random() * 4,
      delay: Math.random() * 5,
      depth: Math.random() * 3,
    })), [])

  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const beta = e.beta || 0
      const gamma = e.gamma || 0
      setTilt({
        x: Math.max(-8, Math.min(8, gamma / 6)),
        y: Math.max(-8, Math.min(8, (beta - 45) / 6)),
      })
    }
    window.addEventListener('deviceorientation', handler)
    return () => window.removeEventListener('deviceorientation', handler)
  }, [])

  return (
    <div className="hd-starfield">
      {stars.map(s => (
        <div
          key={s.id}
          className="hd-star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
            transform: `translate(${tilt.x * (s.depth + 1)}px, ${tilt.y * (s.depth + 1)}px)`,
            transition: 'transform 0.2s ease-out',
          }}
        />
      ))}
      {/* 环形光晕 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '80vmin',
        height: '80vmin',
        transform: `translate(-50%, -50%) translate(${tilt.x * 2}px, ${tilt.y * 2}px)`,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 195, 247, 0.06) 0%, transparent 60%)',
        pointerEvents: 'none',
        transition: 'transform 0.3s ease-out',
      }} />
    </div>
  )
}
