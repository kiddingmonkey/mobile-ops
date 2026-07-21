import { useEffect, useState } from 'react'
import { Badge, TIER_COLOR } from './achievements'
import { BadgeIcon } from './BadgeIcons'
import { fireCaptainReaction } from './captainReactions'

/**
 * 徽章解锁通知
 * 从右下角滑入，3.5 秒后自动淡出
 */
export default function BadgeUnlockToast({
  badges,
  onDismiss,
}: {
  badges: Badge[]
  onDismiss: () => void
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!badges.length) return
    // 舰长会祝贺解锁（延迟一点让 Toast 先出场）
    const rt = setTimeout(() => {
      fireCaptainReaction({ type: 'badge_unlocked', badgeName: badges[0].name })
    }, 400)
    const t = setTimeout(() => setVisible(false), 3500)
    const t2 = setTimeout(onDismiss, 4000)
    return () => {
      clearTimeout(rt)
      clearTimeout(t)
      clearTimeout(t2)
    }
  }, [badges, onDismiss])

  if (!badges.length) return null
  const b = badges[0]
  const color = TIER_COLOR[b.tier]

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 9997,
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s ease, opacity 0.4s ease',
      }}
    >
      <div
        className="hd-panel"
        style={{
          minWidth: 280,
          padding: 0,
          borderColor: color + '80',
          boxShadow: `0 0 30px ${color}66`,
        }}
      >
        <div
          className="hd-panel-header"
          style={{ color, textShadow: `0 0 8px ${color}` }}
        >
          <span>◆ ACHIEVEMENT UNLOCKED</span>
          <span className="hd-text-mono" style={{ fontSize: 10, opacity: 0.8 }}>
            {b.tier.toUpperCase()}
          </span>
        </div>
        <div className="hd-panel-corner tl" />
        <div className="hd-panel-corner tr" />
        <div className="hd-panel-corner bl" />
        <div className="hd-panel-corner br" />

        <div style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            flexShrink: 0,
            animation: 'hd-breathe 2s ease-in-out infinite',
          }}>
            <BadgeIcon badge={b} size={64} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 4,
              textShadow: `0 0 8px ${color}66`,
            }}>
              {b.name}
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}>
              {b.desc}
            </div>
            {badges.length > 1 && (
              <div className="hd-text-mono" style={{
                fontSize: 10,
                color,
                marginTop: 6,
                letterSpacing: '0.1em',
              }}>
                +{badges.length - 1} MORE
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
