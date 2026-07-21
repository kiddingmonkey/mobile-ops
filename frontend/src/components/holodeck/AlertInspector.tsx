import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { api, friendlyApiError } from '@/api/client'
import { fmtRelative } from '@/utils/format'
import { hapticLight } from '@/utils/haptics'
import HoldToConfirm from './HoldToConfirm'
import { pushBridgeEvent } from './BridgeTicker'
import { fireCaptainReaction } from './captainReactions'
import { recordEvent, Badge } from './achievements'

const SEV_COLOR: Record<string, string> = {
  critical: 'var(--hd-emergency)',
  warning: 'var(--warning)',
  info: 'var(--hd-cyan)',
}

const SEV_GLOW: Record<string, string> = {
  critical: 'rgba(255, 59, 92, 0.6)',
  warning: 'rgba(251, 191, 36, 0.6)',
  info: 'rgba(79, 195, 247, 0.6)',
}

interface Props {
  alert: any
  onClose: () => void
  onStrike?: (x: number, y: number, color?: string) => void
  onBadgesUnlocked?: (b: Badge[]) => void
}

export default function AlertInspector({ alert, onClose, onStrike, onBadgesUnlocked }: Props) {
  const nav = useNavigate()
  const [silencing, setSilencing] = useState(false)
  const [duration, setDuration] = useState<'30m' | '1h' | '6h' | '1d'>('1h')
  const targetRef = useRef<HTMLDivElement>(null)

  const alertname = alert.labels?.alertname || alert.name || 'Unknown'
  const severity = alert.severity || alert.labels?.severity || 'info'
  const color = SEV_COLOR[severity] || SEV_COLOR.info
  const glowColor = SEV_GLOW[severity] || SEV_GLOW.info

  const labelEntries = useMemo(() =>
    Object.entries(alert.labels || {}).filter(([k]) => k !== 'alertname'),
    [alert]
  )
  const annotationEntries = useMemo(() =>
    Object.entries(alert.annotations || {}), [alert]
  )

  const doSilence = async (x: number, y: number) => {
    setSilencing(true)
    Toast.show({ icon: 'loading', content: '静默中...', duration: 0 })
    onStrike?.(x, y, color)

    const minutes = duration === '30m' ? 30 : duration === '1h' ? 60 : duration === '6h' ? 360 : 1440
    const now = new Date()
    const endsAt = new Date(now.getTime() + minutes * 60 * 1000)

    try {
      await api.createSilence(1, {
        matchers: [{ name: 'alertname', value: alertname, isRegex: false, isEqual: true }],
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        createdBy: 'holodeck',
        comment: `全息舰桥·蓄力静默 ${duration}`,
      })
      Toast.clear()
      Toast.show({ icon: 'success', content: `星域已清理 · ${duration}` })

      pushBridgeEvent('success', `SILENCED · ${alertname} · ${duration}`)
      fireCaptainReaction({ type: 'silence_success', alertName: alertname, severity })

      const unlocked = recordEvent({ type: 'alert_resolved', severity })
      if (unlocked.length) onBadgesUnlocked?.(unlocked)

      setTimeout(onClose, 800)
    } catch (e) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
      pushBridgeEvent('error', `SILENCE FAILED · ${alertname}`)
      fireCaptainReaction({ type: 'silence_failed', alertName: alertname })
    } finally {
      setSilencing(false)
    }
  }

  const handleConfirm = () => {
    const el = targetRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const x = ((r.left + r.width / 2) / window.innerWidth) * 100
      const y = ((r.top + r.height / 2) / window.innerHeight) * 100
      doSilence(x, y)
    } else {
      doSilence(50, 50)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 5, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9994,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'hd-fade-in 0.3s ease-out',
      }}
    >
      <div
        ref={targetRef}
        onClick={(e) => e.stopPropagation()}
        className="hd-panel"
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderColor: color,
          boxShadow: `0 0 30px ${glowColor}`,
        }}
      >
        <div className="hd-panel-header" style={{ color, textShadow: `0 0 8px ${glowColor}` }}>
          <span>◆ ALERT · {severity.toUpperCase()}</span>
          <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="hd-text-mono" style={{ fontSize: 10, opacity: 0.7 }}>
              {fmtRelative(alert.starts_at || alert.startsAt)}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
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
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 20,
        }}>
          {/* 告警名 */}
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: color,
            marginBottom: 6,
            textShadow: `0 0 12px ${glowColor}`,
            letterSpacing: '0.02em',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {alertname}
          </div>
          {alert.annotations?.summary && (
            <div style={{
              fontSize: 13,
              color: 'var(--text-primary)',
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              {alert.annotations.summary}
            </div>
          )}

          {/* 描述 */}
          {alert.annotations?.description && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(10, 20, 45, 0.55)',
              border: `1px solid ${color}40`,
              borderLeft: `3px solid ${color}`,
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginBottom: 16,
              lineHeight: 1.6,
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {alert.annotations.description}
            </div>
          )}

          {/* 标签 */}
          {labelEntries.length > 0 && (
            <>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                color: 'var(--hd-cyan)',
                marginBottom: 10,
              }}>
                ◇ LABELS ({labelEntries.length})
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 6,
                marginBottom: 16,
              }}>
                {labelEntries.map(([k, v]) => (
                  <div key={k} style={{
                    padding: '6px 10px',
                    background: 'rgba(10, 20, 45, 0.55)',
                    border: '1px solid rgba(120, 200, 255, 0.15)',
                    display: 'flex',
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    <span style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>{k}=</span>
                    <span style={{ color: 'var(--hd-cyan)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 其他 annotations */}
          {annotationEntries.filter(([k]) => k !== 'summary' && k !== 'description').length > 0 && (
            <>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                color: 'var(--hd-cyan)',
                marginBottom: 10,
              }}>
                ◇ META
              </div>
              <div style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--text-secondary)',
                lineHeight: 1.8,
                marginBottom: 16,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {annotationEntries.filter(([k]) => k !== 'summary' && k !== 'description').map(([k, v]) => (
                  <div key={k}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{k}:</span> {String(v)}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 静默时长 */}
          <div style={{
            fontSize: 10,
            letterSpacing: '0.25em',
            color: 'var(--hd-cyan)',
            marginBottom: 10,
          }}>
            ◇ SILENCE DURATION
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            marginBottom: 16,
          }}>
            {(['30m', '1h', '6h', '1d'] as const).map(d => {
              const selected = duration === d
              return (
                <button
                  key={d}
                  onClick={() => { hapticLight(); setDuration(d) }}
                  className="hd-btn"
                  style={{
                    fontSize: 12,
                    padding: '8px 0',
                    background: selected ? 'rgba(79, 195, 247, 0.2)' : 'transparent',
                    borderColor: selected ? 'var(--hd-cyan)' : 'rgba(120, 200, 255, 0.3)',
                    color: selected ? 'var(--hd-cyan)' : 'var(--text-secondary)',
                    boxShadow: selected ? '0 0 12px var(--hd-cyan-glow)' : 'none',
                    textShadow: 'none',
                  }}
                >
                  {d.toUpperCase()}
                </button>
              )
            })}
          </div>

          {/* 蓄力 + 更多动作 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
            <HoldToConfirm
              label={`HOLD · 静默 ${duration}`}
              duration={1800}
              color={color}
              glowColor={glowColor}
              onConfirm={handleConfirm}
              disabled={silencing}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                className="hd-btn"
                onClick={() => { hapticLight(); onClose(); nav(`/alerts?id=${alert.id}`) }}
                style={{ fontSize: 11, width: '100%' }}
              >
                ▸ 在告警页展开
              </button>
              {alert.generator_url && (
                <a
                  href={alert.generator_url}
                  target="_blank"
                  rel="noreferrer"
                  className="hd-btn"
                  style={{
                    fontSize: 11,
                    width: '100%',
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  ▸ VIEW IN VM
                </a>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                长按环形充能 1.8s 静默此告警
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
