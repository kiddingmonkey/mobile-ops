/**
 * 4 套舰长剪影 SVG
 * 用 CSS 变量控制颜色，随主题变化
 */

export type SilhouetteId = 'lyra' | 'mio' | 'scarlet' | 'nova'

const GRAD_DEF = (
  <defs>
    <linearGradient id="cap-grad-primary" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="rgba(79,195,247,0.95)" />
      <stop offset="50%" stopColor="rgba(232,121,249,0.75)" />
      <stop offset="100%" stopColor="rgba(79,195,247,0.35)" />
    </linearGradient>
    <linearGradient id="cap-grad-warm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="rgba(255,180,120,0.95)" />
      <stop offset="50%" stopColor="rgba(255,120,180,0.7)" />
      <stop offset="100%" stopColor="rgba(255,180,120,0.3)" />
    </linearGradient>
    <linearGradient id="cap-grad-mystic" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="rgba(180,130,255,0.95)" />
      <stop offset="50%" stopColor="rgba(90,200,255,0.7)" />
      <stop offset="100%" stopColor="rgba(180,130,255,0.3)" />
    </linearGradient>
  </defs>
)

// 剪影 1: 长发指挥官 · 璃（默认）
function LyraSilhouette() {
  return (
    <svg viewBox="0 0 200 320" style={svgStyle()}>
      {GRAD_DEF}
      <ellipse cx="100" cy="55" rx="26" ry="30" fill="none" stroke="url(#cap-grad-primary)" strokeWidth="1.5" />
      <path d="M74,60 Q60,120 55,200 Q60,240 70,260 M126,60 Q140,120 145,200 Q140,240 130,260"
        fill="none" stroke="url(#cap-grad-primary)" strokeWidth="1.5" />
      <path d="M60,110 Q100,100 140,110 L145,140 Q100,130 55,140 Z"
        fill="none" stroke="url(#cap-grad-primary)" strokeWidth="1.5" />
      <path d="M75,140 L70,240 L80,300 M125,140 L130,240 L120,300"
        fill="none" stroke="url(#cap-grad-primary)" strokeWidth="1.5" />
      <circle cx="100" cy="170" r="6" fill="none" stroke="var(--hd-cyan)" strokeWidth="1" opacity="0.8" />
      <circle cx="100" cy="170" r="2" fill="var(--hd-cyan)">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

// 剪影 2: 双马尾机甲师 · 澪
function MioSilhouette() {
  return (
    <svg viewBox="0 0 200 320" style={svgStyle()}>
      {GRAD_DEF}
      {/* 头部 */}
      <ellipse cx="100" cy="55" rx="24" ry="28" fill="none" stroke="url(#cap-grad-mystic)" strokeWidth="1.5" />
      {/* 双马尾 */}
      <path d="M78,55 Q40,90 30,160 Q35,190 45,210 M122,55 Q160,90 170,160 Q165,190 155,210"
        fill="none" stroke="url(#cap-grad-mystic)" strokeWidth="1.5" />
      {/* 马尾发带 */}
      <ellipse cx="38" cy="95" rx="4" ry="6" fill="none" stroke="url(#cap-grad-mystic)" strokeWidth="1.2" />
      <ellipse cx="162" cy="95" rx="4" ry="6" fill="none" stroke="url(#cap-grad-mystic)" strokeWidth="1.2" />
      {/* 机甲肩甲（更宽） */}
      <path d="M55,110 Q100,95 145,110 L152,145 L150,155 L50,155 L48,145 Z"
        fill="none" stroke="url(#cap-grad-mystic)" strokeWidth="1.5" />
      {/* 身体+腰带 */}
      <path d="M70,155 L65,240 L75,300 M130,155 L135,240 L125,300"
        fill="none" stroke="url(#cap-grad-mystic)" strokeWidth="1.5" />
      <line x1="65" y1="200" x2="135" y2="200" stroke="url(#cap-grad-mystic)" strokeWidth="1.2" />
      {/* 胸甲能量核 */}
      <polygon points="100,165 108,175 100,185 92,175" fill="none" stroke="var(--hd-magenta)" strokeWidth="1.2" />
      <circle cx="100" cy="175" r="2" fill="var(--hd-magenta)">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

// 剪影 3: 短发狙击手 · 绯
function ScarletSilhouette() {
  return (
    <svg viewBox="0 0 200 320" style={svgStyle()}>
      {GRAD_DEF}
      {/* 头部 */}
      <ellipse cx="100" cy="55" rx="25" ry="29" fill="none" stroke="url(#cap-grad-warm)" strokeWidth="1.5" />
      {/* 短发 */}
      <path d="M76,42 Q80,30 100,28 Q120,30 124,42 Q126,55 122,72 M78,72 Q75,58 76,42"
        fill="none" stroke="url(#cap-grad-warm)" strokeWidth="1.5" />
      {/* 单侧长发 */}
      <path d="M124,60 Q140,110 138,180 Q135,220 130,250" fill="none" stroke="url(#cap-grad-warm)" strokeWidth="1.5" />
      {/* 高领风衣 */}
      <path d="M78,90 Q80,105 78,120 M122,90 Q120,105 122,120" fill="none" stroke="url(#cap-grad-warm)" strokeWidth="1.5" />
      {/* 风衣肩线 */}
      <path d="M60,115 Q100,105 140,115 L148,155 Q100,145 52,155 Z"
        fill="none" stroke="url(#cap-grad-warm)" strokeWidth="1.5" />
      {/* 长风衣下摆 */}
      <path d="M55,155 L45,300 M145,155 L155,300 M100,160 L100,300"
        fill="none" stroke="url(#cap-grad-warm)" strokeWidth="1.5" />
      {/* 胸章 */}
      <rect x="93" y="170" width="14" height="4" fill="none" stroke="var(--hd-emergency)" strokeWidth="1" />
      <rect x="93" y="178" width="14" height="4" fill="none" stroke="var(--hd-emergency)" strokeWidth="1" opacity="0.6" />
    </svg>
  )
}

// 剪影 4: 星辰法师 · 星
function NovaSilhouette() {
  return (
    <svg viewBox="0 0 200 320" style={svgStyle()}>
      {GRAD_DEF}
      {/* 星冠 */}
      <path d="M85,32 L92,20 L100,32 L108,20 L115,32" fill="none" stroke="var(--hd-cyan)" strokeWidth="1.2" opacity="0.9" />
      <circle cx="100" cy="18" r="2" fill="var(--hd-cyan)">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* 头部 */}
      <ellipse cx="100" cy="55" rx="26" ry="30" fill="none" stroke="url(#cap-grad-primary)" strokeWidth="1.5" />
      {/* 波浪长发 */}
      <path d="M74,65 Q55,110 62,180 Q70,230 65,280 M126,65 Q145,110 138,180 Q130,230 135,280"
        fill="none" stroke="url(#cap-grad-primary)" strokeWidth="1.5" />
      {/* 披风领 */}
      <path d="M72,90 Q100,82 128,90 L138,110 Q100,102 62,110 Z"
        fill="none" stroke="url(#cap-grad-primary)" strokeWidth="1.5" />
      {/* 长袍 */}
      <path d="M62,110 Q55,180 50,270 L60,300 M138,110 Q145,180 150,270 L140,300 M100,115 L100,300"
        fill="none" stroke="url(#cap-grad-primary)" strokeWidth="1.5" />
      {/* 悬浮星阵 */}
      <g style={{ transformOrigin: '100px 195px', animation: 'hd-orbit 15s linear infinite' }}>
        <circle cx="115" cy="195" r="2" fill="var(--hd-cyan)" opacity="0.8" />
        <circle cx="85" cy="195" r="1.5" fill="var(--hd-magenta)" opacity="0.6" />
        <circle cx="100" cy="180" r="1.8" fill="#E8F4FF" opacity="0.7" />
      </g>
      <circle cx="100" cy="195" r="8" fill="none" stroke="var(--hd-cyan)" strokeWidth="0.8" opacity="0.4"
        strokeDasharray="2 3" />
    </svg>
  )
}

function svgStyle(): React.CSSProperties {
  return {
    height: '100%',
    maxHeight: '100%',
    filter: 'drop-shadow(0 0 12px var(--hd-cyan-glow))',
    animation: 'hd-breathe 4s ease-in-out infinite',
    position: 'relative',
    zIndex: 1,
  }
}

export const SILHOUETTES: Record<SilhouetteId, {
  id: SilhouetteId
  name: string
  callsign: string
  desc: string
  Component: React.FC
}> = {
  lyra: { id: 'lyra', name: '星舰之心·璃', callsign: 'LYRA-01', desc: '长发系 · 沉稳指挥官', Component: LyraSilhouette },
  mio: { id: 'mio', name: '苍穹机甲师·澪', callsign: 'MIO-07', desc: '双马尾 · 高机动战术官', Component: MioSilhouette },
  scarlet: { id: 'scarlet', name: '深空之影·绯', callsign: 'SCARLET', desc: '短发风衣 · 冷峻狙击手', Component: ScarletSilhouette },
  nova: { id: 'nova', name: '星辰法师·星', callsign: 'NOVA-∞', desc: '星阵披风 · 战术咨询官', Component: NovaSilhouette },
}
