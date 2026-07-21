import { Badge, TIER_COLOR } from './achievements'

/**
 * 7 种徽章图标（纯 SVG）
 * 传入 tier 决定描边颜色
 */

export function BadgeIcon({ badge, size = 56 }: { badge: Badge; size?: number }) {
  const color = TIER_COLOR[badge.tier]
  const inner = renderInner(badge.icon, color)

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <radialGradient id={`bg-${badge.id}`} cx="50%" cy="40%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 外六边形 */}
      <polygon
        points="50,8 86,28 86,72 50,92 14,72 14,28"
        fill={`url(#bg-${badge.id})`}
        stroke={color}
        strokeWidth="1.5"
      />
      {/* 内六边形 */}
      <polygon
        points="50,20 76,34 76,66 50,80 24,66 24,34"
        fill="none"
        stroke={color}
        strokeWidth="0.8"
        opacity="0.6"
      />
      {inner}
    </svg>
  )
}

function renderInner(icon: Badge['icon'], color: string) {
  switch (icon) {
    case 'shield':
      return (
        <path
          d="M50 32 L64 38 L64 55 Q64 65 50 72 Q36 65 36 55 L36 38 Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )
    case 'moon':
      return (
        <>
          <path
            d="M58 32 A20 20 0 1 0 58 72 A16 16 0 1 1 58 32 Z"
            fill={color}
            opacity="0.7"
          />
          <circle cx="68" cy="42" r="1.5" fill={color} />
          <circle cx="72" cy="55" r="1" fill={color} opacity="0.8" />
        </>
      )
    case 'flame':
      return (
        <path
          d="M50 30 Q42 44 45 52 Q40 50 42 60 Q45 74 50 74 Q55 74 58 60 Q60 50 55 52 Q58 44 50 30 Z"
          fill={color}
          opacity="0.75"
        />
      )
    case 'compass':
      return (
        <>
          <circle cx="50" cy="52" r="16" fill="none" stroke={color} strokeWidth="1.5" />
          <polygon points="50,40 55,52 50,64 45,52" fill={color} opacity="0.8" />
          <circle cx="50" cy="52" r="2" fill={color} />
        </>
      )
    case 'anchor':
      return (
        <>
          <circle cx="50" cy="34" r="4" fill="none" stroke={color} strokeWidth="1.5" />
          <line x1="50" y1="38" x2="50" y2="70" stroke={color} strokeWidth="1.5" />
          <path
            d="M38 60 Q50 76 62 60"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line x1="42" y1="46" x2="58" y2="46" stroke={color} strokeWidth="1.5" />
        </>
      )
    case 'nebula':
      return (
        <>
          <circle cx="50" cy="52" r="14" fill="none" stroke={color} strokeWidth="1.2" opacity="0.4" />
          <circle cx="50" cy="52" r="9" fill="none" stroke={color} strokeWidth="1.2" opacity="0.7" />
          <circle cx="50" cy="52" r="4" fill={color} />
          <circle cx="66" cy="46" r="1.5" fill={color} opacity="0.7" />
          <circle cx="36" cy="58" r="1.2" fill={color} opacity="0.6" />
          <circle cx="58" cy="66" r="1" fill={color} opacity="0.5" />
        </>
      )
    case 'crown':
      return (
        <>
          <path
            d="M32 62 L36 40 L44 52 L50 34 L56 52 L64 40 L68 62 Z"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <line x1="32" y1="68" x2="68" y2="68" stroke={color} strokeWidth="1.5" />
          <circle cx="50" cy="34" r="2" fill={color} />
        </>
      )
  }
}
