import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/store'
import { hapticLight } from '@/utils/haptics'
import {
  SCAPES, SoundScapeId,
  playSoundscape, setSoundscapeVolume,
  getCurrentScape, getCurrentVolume,
} from './soundscape'

/**
 * 快速指令抽屉
 * - 从右边缘滑入
 * - 含常用指令 + 环境音景 + 主题切换
 */

export default function QuickCommandDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const nav = useNavigate()
  const setTheme = useTheme(s => s.setMode)
  const [scape, setScape] = useState<SoundScapeId>(() => getCurrentScape())
  const [volume, setVolume] = useState<number>(() => getCurrentVolume())

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const chooseScape = (id: SoundScapeId) => {
    hapticLight()
    setScape(id)
    playSoundscape(id, volume)
  }

  const handleVolume = (v: number) => {
    setVolume(v)
    setSoundscapeVolume(v)
  }

  const nav2 = (path: string) => {
    hapticLight()
    onClose()
    nav(path)
  }

  return (
    <>
      {/* 半透明遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 5, 16, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 9993,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* 抽屉本体 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(360px, 85vw)',
          zIndex: 9994,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
          padding: '12px',
        }}
      >
        <div
          className="hd-panel"
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div className="hd-panel-header">
            <span>◆ QUICK COMMAND</span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: 14,
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
          <div className="hd-panel-corner tl" />
          <div className="hd-panel-corner tr" />
          <div className="hd-panel-corner bl" />
          <div className="hd-panel-corner br" />

          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '14px 16px',
          }}>
            {/* 常用指令 */}
            <SectionTitle>NAVIGATION</SectionTitle>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginBottom: 16,
            }}>
              <CmdBtn label="DIAGNOSE" onClick={() => nav2('/diagnose')} />
              <CmdBtn label="TASKS" onClick={() => nav2('/tasks')} />
              <CmdBtn label="ALERTS" onClick={() => nav2('/alerts')} />
              <CmdBtn label="CLUSTERS" onClick={() => nav2('/cluster-resources')} />
              <CmdBtn label="MONITOR" onClick={() => nav2('/monitor')} />
              <CmdBtn label="SETTINGS" onClick={() => nav2('/settings')} />
            </div>

            {/* 环境音景 */}
            <SectionTitle>SOUNDSCAPE</SectionTitle>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginBottom: 12,
            }}>
              {SCAPES.map(s => {
                const active = s.id === scape
                return (
                  <div
                    key={s.id}
                    onClick={() => chooseScape(s.id)}
                    style={{
                      padding: '8px 10px',
                      background: active ? 'rgba(79, 195, 247, 0.15)' : 'rgba(10, 20, 45, 0.5)',
                      border: `1px solid ${active ? 'var(--hd-cyan)' : 'rgba(120, 200, 255, 0.15)'}`,
                      borderRadius: 2,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: active ? '0 0 12px var(--hd-cyan-glow)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: active ? 'var(--hd-cyan)' : 'var(--text-primary)',
                        letterSpacing: '0.05em',
                      }}>
                        {s.name}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        marginTop: 2,
                      }}>
                        {s.desc}
                      </div>
                    </div>
                    {active && (
                      <div className="hd-text-mono" style={{
                        fontSize: 9,
                        color: 'var(--hd-cyan)',
                        letterSpacing: '0.15em',
                      }}>
                        ● LIVE
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 音量 */}
            {scape !== 'off' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  letterSpacing: '0.15em',
                  marginBottom: 4,
                }}>
                  <span>VOLUME</span>
                  <span className="hd-text-mono">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={e => handleVolume(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--hd-cyan)',
                  }}
                />
              </div>
            )}

            {/* 主题切换 */}
            <SectionTitle>THEME</SectionTitle>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginBottom: 16,
            }}>
              <CmdBtn label="EXIT · DARK" onClick={() => { hapticLight(); setTheme('dark') }} />
              <CmdBtn label="GUOFENG" onClick={() => { hapticLight(); setTheme('guofeng') }} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      letterSpacing: '0.25em',
      color: 'var(--hd-cyan)',
      textShadow: '0 0 6px var(--hd-cyan-glow)',
      marginBottom: 8,
      fontWeight: 600,
    }}>
      ◇ {children}
    </div>
  )
}

function CmdBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="hd-btn"
      style={{ fontSize: 11, padding: '10px 8px', width: '100%' }}
    >
      {label}
    </button>
  )
}
