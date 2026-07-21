import { useMemo, useState } from 'react'
import { BADGE_CATALOG, Badge, loadBadges, TIER_COLOR } from './achievements'
import { BadgeIcon } from './BadgeIcons'

export default function BadgeWall({ onClose }: { onClose: () => void }) {
  const unlocked = useMemo(() => loadBadges(), [])
  const [selected, setSelected] = useState<Badge | null>(null)

  const badges = BADGE_CATALOG.map(spec => {
    const u = unlocked[spec.id]
    return u ? u : { ...spec, unlockedAt: undefined }
  })

  const unlockedCount = Object.keys(unlocked).length
  const total = BADGE_CATALOG.length

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 5, 16, 0.9)',
        backdropFilter: 'blur(8px)',
        zIndex: 9995,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="hd-panel"
        style={{
          width: '100%',
          maxWidth: 800,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 0,
        }}
      >
        <div className="hd-panel-header">
          <span>◆ ACHIEVEMENT GALLERY</span>
          <span className="hd-text-mono" style={{ fontSize: 10, opacity: 0.8 }}>
            {unlockedCount}/{total}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                marginLeft: 12,
                fontSize: 14,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </span>
        </div>
        <div className="hd-panel-corner tl" />
        <div className="hd-panel-corner tr" />
        <div className="hd-panel-corner bl" />
        <div className="hd-panel-corner br" />

        <div style={{
          padding: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 14,
        }}>
          {badges.map(b => {
            const locked = !b.unlockedAt
            return (
              <div
                key={b.id}
                onClick={() => setSelected(b)}
                style={{
                  padding: 12,
                  background: 'rgba(10, 20, 45, 0.5)',
                  border: `1px solid ${locked ? 'rgba(120, 200, 255, 0.15)' : TIER_COLOR[b.tier] + '55'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  borderRadius: 2,
                  filter: locked ? 'grayscale(1) brightness(0.5)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              >
                <div style={{
                  animation: !locked ? 'hd-breathe 3s ease-in-out infinite' : 'none',
                }}>
                  <BadgeIcon badge={b} size={56} />
                </div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}>
                  {locked ? '???' : b.name}
                </div>
                <div className="hd-text-mono" style={{
                  fontSize: 9,
                  color: TIER_COLOR[b.tier],
                  letterSpacing: '0.15em',
                }}>
                  {b.tier.toUpperCase()}
                </div>
              </div>
            )
          })}
        </div>

        {selected && (
          <div style={{
            padding: '0 20px 20px',
            borderTop: '1px solid rgba(120, 200, 255, 0.15)',
            paddingTop: 16,
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                <BadgeIcon badge={selected} size={80} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}>
                  {selected.unlockedAt ? selected.name : '未解锁'}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                  lineHeight: 1.5,
                }}>
                  {selected.desc}
                </div>
                {selected.unlockedAt && (
                  <div className="hd-text-mono" style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.1em',
                  }}>
                    UNLOCKED · {new Date(selected.unlockedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
