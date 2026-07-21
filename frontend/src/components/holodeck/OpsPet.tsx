import { useEffect, useState } from 'react'
import { hapticLight } from '@/utils/haptics'

type Mood = 'calm' | 'alert' | 'combat'

/**
 * 运维精灵 · 机械猫（低多边形风格）
 * - calm: 眯眼睡觉 / 尾巴轻摆
 * - alert: 竖耳警觉 / 眼睛扫描
 * - combat: 弓背炸毛 / 红色警戒灯
 */
export default function OpsPet({ mood }: { mood: Mood }) {
  const [poked, setPoked] = useState(0)
  const [tailPhase, setTailPhase] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTailPhase(p => p + 1), 400)
    return () => clearInterval(t)
  }, [])

  const handlePoke = () => {
    hapticLight()
    setPoked(p => p + 1)
    setTimeout(() => setPoked(p => Math.max(0, p - 1)), 800)
  }

  const isPoked = poked > 0
  const eyeColor = mood === 'combat' ? '#FF3B5C' : mood === 'alert' ? '#FBBF24' : '#4FC3F7'
  const bodyColor = mood === 'combat' ? '#FF3B5C' : 'rgba(79, 195, 247, 0.9)'
  const tailSway = Math.sin(tailPhase / 2) * (mood === 'combat' ? 15 : mood === 'alert' ? 8 : 4)

  return (
    <div
      onClick={handlePoke}
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        width: 60,
        height: 60,
        cursor: 'pointer',
        zIndex: 5,
        filter: `drop-shadow(0 0 8px ${eyeColor}55)`,
      }}
      title="点我"
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <linearGradient id="pet-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={bodyColor} stopOpacity="0.7" />
            <stop offset="100%" stopColor={bodyColor} stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* 尾巴 */}
        <g style={{ transformOrigin: '78px 62px', transform: `rotate(${tailSway}deg)` }}>
          <path
            d={`M 78 62 Q 88 ${55 + Math.sin(tailPhase) * 3} 92 ${45 + Math.cos(tailPhase) * 4}`}
            fill="none"
            stroke={bodyColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="92" cy={45 + Math.cos(tailPhase) * 4} r="2.5" fill={eyeColor} opacity="0.8" />
        </g>

        {/* 身体（弓背状态在 combat 时） */}
        <ellipse
          cx="50"
          cy={mood === 'combat' ? 58 : 62}
          rx={mood === 'combat' ? 22 : 24}
          ry={mood === 'combat' ? 14 : 12}
          fill="url(#pet-body)"
          stroke={bodyColor}
          strokeWidth="1.5"
        />

        {/* 头部 */}
        <circle
          cx="35"
          cy={isPoked ? 40 : 45}
          r="14"
          fill="url(#pet-body)"
          stroke={bodyColor}
          strokeWidth="1.5"
          style={{ transition: 'all 0.2s ease' }}
        />

        {/* 耳朵（警觉时竖起，紧急时炸开） */}
        {mood === 'combat' ? (
          <>
            <polygon points="26,35 24,25 32,32" fill={bodyColor} opacity="0.9" />
            <polygon points="44,35 46,25 38,32" fill={bodyColor} opacity="0.9" />
          </>
        ) : mood === 'alert' ? (
          <>
            <polygon points="28,38 26,26 34,34" fill={bodyColor} opacity="0.9" />
            <polygon points="42,38 44,26 36,34" fill={bodyColor} opacity="0.9" />
          </>
        ) : (
          <>
            <polygon points="28,40 27,32 34,36" fill={bodyColor} opacity="0.7" />
            <polygon points="42,40 43,32 36,36" fill={bodyColor} opacity="0.7" />
          </>
        )}

        {/* 眼睛 */}
        {mood === 'calm' && !isPoked ? (
          <>
            {/* 眯眼 */}
            <path d="M 28 46 Q 31 44 34 46" stroke={eyeColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 36 46 Q 39 44 42 46" stroke={eyeColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            {/* 睡眠 Z */}
            <text x="52" y="35" fontSize="10" fill={eyeColor} opacity="0.6" fontFamily="monospace">z</text>
          </>
        ) : (
          <>
            {/* 睁眼 */}
            <circle cx="31" cy={isPoked ? 40 : 45} r="2.5" fill={eyeColor}>
              <animate attributeName="r" values="2.5;2.5;2.2;2.5" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="39" cy={isPoked ? 40 : 45} r="2.5" fill={eyeColor}>
              <animate attributeName="r" values="2.5;2.5;2.2;2.5" dur="4s" repeatCount="indefinite" />
            </circle>
          </>
        )}

        {/* 嘴 */}
        {isPoked ? (
          <path d="M 33 51 Q 35 54 37 51" stroke={eyeColor} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        ) : mood === 'combat' ? (
          <path d="M 32 52 L 34 50 L 36 52 L 38 50" stroke={eyeColor} strokeWidth="1.2" fill="none" />
        ) : (
          <path d="M 33 52 Q 35 53 37 52" stroke={eyeColor} strokeWidth="1" fill="none" opacity="0.7" />
        )}

        {/* 紧急警戒灯 */}
        {mood === 'combat' && (
          <circle cx="50" cy="48" r="3" fill="#FF3B5C">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="0.8s" repeatCount="indefinite" />
          </circle>
        )}

        {/* 抚摸粒子 */}
        {isPoked && [0, 1, 2].map(i => (
          <circle
            key={i}
            cx={35 + (i - 1) * 8}
            cy={25}
            r="1.5"
            fill={eyeColor}
          >
            <animate attributeName="cy" values="25;15;10" dur="0.8s" fill="freeze" />
            <animate attributeName="opacity" values="1;0.5;0" dur="0.8s" fill="freeze" />
          </circle>
        ))}
      </svg>
    </div>
  )
}
