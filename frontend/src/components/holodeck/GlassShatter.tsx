import { useMemo } from 'react'

/**
 * P0 玻璃碎裂效果
 * 在紧急模式（body.hd-emergency）时叠加在屏幕上
 * - 四角出现玻璃裂纹（SVG）
 * - 边缘红色呼吸光晕（由 holodeck-theme.css 提供）
 * - 微震动配合
 */

interface Crack {
  origin: 'tl' | 'tr' | 'bl' | 'br'
  segments: string
}

function generateCracks(seed = 1): Crack[] {
  const rnd = (function () {
    let s = seed
    return () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
  })()

  const originPoints: Record<Crack['origin'], [number, number]> = {
    tl: [0, 0],
    tr: [100, 0],
    bl: [0, 100],
    br: [100, 100],
  }

  const cracks: Crack[] = []
  ;(Object.keys(originPoints) as Crack['origin'][]).forEach(origin => {
    const [ox, oy] = originPoints[origin]
    const segs: string[] = []

    // 主裂纹 3-4 条从角发散
    const mainCount = 3 + Math.floor(rnd() * 2)
    for (let i = 0; i < mainCount; i++) {
      const parts: string[] = [`M ${ox} ${oy}`]
      let x = ox
      let y = oy
      const seg = 3 + Math.floor(rnd() * 4)
      const baseAngle =
        origin === 'tl' ? (10 + rnd() * 80) :
        origin === 'tr' ? (100 + rnd() * 80) :
        origin === 'bl' ? (280 + rnd() * 80) :
        (190 + rnd() * 80)

      for (let j = 0; j < seg; j++) {
        const wobble = (rnd() - 0.5) * 40
        const ang = ((baseAngle + wobble) * Math.PI) / 180
        const len = 4 + rnd() * 8
        x += Math.cos(ang) * len
        y += Math.sin(ang) * len
        parts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`)

        // 分叉
        if (rnd() > 0.55 && j > 0) {
          const bx = x + Math.cos(ang + (rnd() - 0.5) * 1.4) * (2 + rnd() * 4)
          const by = y + Math.sin(ang + (rnd() - 0.5) * 1.4) * (2 + rnd() * 4)
          segs.push(`M ${x.toFixed(1)} ${y.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)}`)
        }
      }
      segs.push(parts.join(' '))
    }

    cracks.push({ origin, segments: segs.join(' ') })
  })

  return cracks
}

export default function GlassShatter({ active }: { active: boolean }) {
  const cracks = useMemo(() => generateCracks(42), [])

  if (!active) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9989,
      pointerEvents: 'none',
      animation: 'hd-shake 6s ease-in-out infinite',
    }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.55,
          mixBlendMode: 'screen',
        }}
      >
        <defs>
          <filter id="crack-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {cracks.map((c, i) => (
          <g key={c.origin} filter="url(#crack-glow)">
            <path
              d={c.segments}
              stroke="#FF3B5C"
              strokeWidth="0.15"
              fill="none"
              opacity="0.9"
              vectorEffect="non-scaling-stroke"
              style={{ animation: `hd-crack-appear 0.8s ease-out ${i * 0.1}s backwards` }}
            />
            <path
              d={c.segments}
              stroke="#FFFFFF"
              strokeWidth="0.06"
              fill="none"
              opacity="0.7"
              vectorEffect="non-scaling-stroke"
              style={{ animation: `hd-crack-appear 0.8s ease-out ${i * 0.1}s backwards` }}
            />
          </g>
        ))}
      </svg>

      {/* 四角红色扩散光 */}
      {(['tl', 'tr', 'bl', 'br'] as const).map(pos => (
        <div
          key={pos}
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            top: pos.startsWith('t') ? -100 : 'auto',
            bottom: pos.startsWith('b') ? -100 : 'auto',
            left: pos.endsWith('l') ? -100 : 'auto',
            right: pos.endsWith('r') ? -100 : 'auto',
            background: 'radial-gradient(circle, rgba(255,59,92,0.35) 0%, transparent 60%)',
            animation: 'hd-breathe 2s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}
