import { useMemo } from 'react'

const PETAL_COUNT = 18
const FIREFLY_COUNT = 12
const CLOUD_COUNT = 4

export default function GuofengBackground() {
  const petals = useMemo(() =>
    Array.from({ length: PETAL_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 6 + Math.random() * 8,
      duration: 8 + Math.random() * 12,
      swayDuration: 3 + Math.random() * 4,
      delay: Math.random() * 15,
      opacity: 0.3 + Math.random() * 0.5,
    })), [])

  const fireflies = useMemo(() =>
    Array.from({ length: FIREFLY_COUNT }, (_, i) => ({
      id: i,
      left: `${10 + Math.random() * 80}%`,
      top: `${20 + Math.random() * 60}%`,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 5,
      size: 3 + Math.random() * 3,
    })), [])

  const clouds = useMemo(() =>
    Array.from({ length: CLOUD_COUNT }, (_, i) => ({
      id: i,
      top: `${15 + i * 18}%`,
      width: 200 + Math.random() * 300,
      duration: 40 + Math.random() * 30,
      delay: i * 10,
    })), [])

  return (
    <div className="gf-parallax-container">
      {/* 远景：深邃星空+渐变 */}
      <div className="gf-layer-far" />

      {/* 远山轮廓 */}
      <div className="gf-mountain">
        <svg viewBox="0 0 1200 400" preserveAspectRatio="none">
          <path
            d="M0,400 L0,320 Q100,250 200,300 Q350,200 450,260
               Q550,180 650,240 Q800,150 900,220 Q1000,170 1100,250
               Q1150,280 1200,300 L1200,400 Z"
            fill="rgba(180,150,90,0.08)"
          />
          <path
            d="M0,400 L0,350 Q150,300 300,340 Q450,280 600,320
               Q750,260 900,300 Q1050,270 1200,330 L1200,400 Z"
            fill="rgba(180,150,90,0.05)"
          />
        </svg>
      </div>

      {/* 中景：云雾飘动 */}
      <div className="gf-layer-mid">
        {clouds.map(c => (
          <div
            key={c.id}
            className="gf-cloud"
            style={{
              top: c.top,
              width: c.width,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}
      </div>

      {/* 近景：花瓣飘落 + 萤火虫 */}
      <div className="gf-layer-near">
        {petals.map(p => (
          <div
            key={p.id}
            className="gf-petal"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s, ${p.swayDuration}s`,
              animationDelay: `${p.delay}s, ${p.delay}s`,
              opacity: p.opacity,
            }}
          />
        ))}
        {fireflies.map(f => (
          <div
            key={f.id}
            className="gf-firefly"
            style={{
              left: f.left,
              top: f.top,
              width: f.size,
              height: f.size,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}