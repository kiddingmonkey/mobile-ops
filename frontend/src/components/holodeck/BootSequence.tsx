import { useEffect, useState } from 'react'
import { SILHOUETTES, SilhouetteId } from './CaptainSilhouettes'
import { CAPTAIN_STORAGE_KEY } from './HolodeckCaptain'

/**
 * 首次进入 Holodeck 的启动序列
 * - 黑屏亮起舰徽 → 舰长立绘淡入 → 系统扫描 → 舰长台词 → 完成
 * - 完成后 localStorage 记住，不再播放
 * - 用户可跳过
 */

const BOOT_DONE_KEY = 'holodeck_boot_seen_v1'

const PHASES = [
  { key: 'logo', label: 'INITIALIZING BRIDGE', duration: 900 },
  { key: 'scan', label: 'SCANNING STELLAR FIELD', duration: 1100 },
  { key: 'greet', label: 'CAPTAIN ONLINE', duration: 1800 },
] as const

interface CaptainConfig {
  name: string
  callsign: string
  silhouette?: SilhouetteId
  portraitUrl?: string
}

function loadCaptain(): CaptainConfig {
  try {
    const s = localStorage.getItem(CAPTAIN_STORAGE_KEY)
    if (s) return { silhouette: 'lyra', ...JSON.parse(s) }
  } catch {}
  const s = SILHOUETTES.lyra
  return { name: s.name, callsign: s.callsign, silhouette: 'lyra' }
}

export function shouldPlayBoot(): boolean {
  try {
    return !localStorage.getItem(BOOT_DONE_KEY)
  } catch {
    return true
  }
}

export function markBootSeen() {
  try {
    localStorage.setItem(BOOT_DONE_KEY, String(Date.now()))
  } catch {}
}

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [captain] = useState<CaptainConfig>(() => loadCaptain())

  useEffect(() => {
    const total = PHASES.reduce((s, p) => s + p.duration, 0)
    let elapsed = 0
    let raf: number | null = null
    const start = performance.now()

    const tick = () => {
      const now = performance.now()
      elapsed = now - start
      let acc = 0
      let idx = 0
      for (let i = 0; i < PHASES.length; i++) {
        if (elapsed < acc + PHASES[i].duration) {
          idx = i
          break
        }
        acc += PHASES[i].duration
        idx = i + 1
      }
      setPhaseIdx(Math.min(idx, PHASES.length - 1))
      setProgress(Math.min(1, elapsed / total))

      if (elapsed >= total) {
        markBootSeen()
        onDone()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { if (raf !== null) cancelAnimationFrame(raf) }
  }, [onDone])

  const phase = PHASES[phaseIdx]
  const Silhouette = captain.silhouette && SILHOUETTES[captain.silhouette]
    ? SILHOUETTES[captain.silhouette].Component
    : SILHOUETTES.lyra.Component

  const showLogo = phaseIdx === 0
  const showCaptain = phaseIdx >= 1

  const skip = () => {
    markBootSeen()
    onDone()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#030510',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* 背景扫描线 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 50% 50%, rgba(79,195,247,0.1) 0%, transparent 60%),
          repeating-linear-gradient(0deg, transparent 0, transparent 4px, rgba(79,195,247,0.03) 4px, rgba(79,195,247,0.03) 5px)
        `,
        opacity: showCaptain ? 0.5 : 1,
        transition: 'opacity 0.6s ease',
      }} />

      {/* 中央内容 */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32,
        maxWidth: 700,
        width: '100%',
        padding: '0 24px',
      }}>
        {/* 舰徽 / 舰长立绘 */}
        <div style={{
          height: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {showLogo && (
            <div
              style={{
                animation: 'hd-fade-in 0.6s ease-out, hd-breathe 2s ease-in-out infinite 0.6s',
              }}
            >
              <svg viewBox="0 0 200 200" width="180" height="180">
                <defs>
                  <linearGradient id="boot-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#4FC3F7" />
                    <stop offset="100%" stopColor="#E879F9" />
                  </linearGradient>
                </defs>
                {/* 六角舰徽 */}
                <polygon
                  points="100,16 172,56 172,144 100,184 28,144 28,56"
                  fill="none"
                  stroke="url(#boot-grad)"
                  strokeWidth="2"
                />
                <polygon
                  points="100,40 148,68 148,132 100,160 52,132 52,68"
                  fill="none"
                  stroke="url(#boot-grad)"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <text
                  x="100" y="112"
                  textAnchor="middle"
                  fill="url(#boot-grad)"
                  fontSize="30"
                  fontFamily="monospace"
                  fontWeight="700"
                  letterSpacing="0.3em"
                >
                  CP
                </text>
                <circle cx="100" cy="140" r="3" fill="#4FC3F7">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
          )}
          {showCaptain && (
            <div style={{
              height: 280,
              animation: 'hd-fade-in 0.8s ease-out',
              filter: 'drop-shadow(0 0 24px rgba(79,195,247,0.5))',
            }}>
              {captain.portraitUrl ? (
                <img
                  src={captain.portraitUrl}
                  alt={captain.name}
                  style={{ height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <Silhouette />
              )}
            </div>
          )}

          {/* 底座光环 */}
          <div style={{
            position: 'absolute',
            bottom: -8,
            width: '60%',
            height: 30,
            background: 'radial-gradient(ellipse, rgba(79,195,247,0.5) 0%, transparent 70%)',
            filter: 'blur(4px)',
          }} />
        </div>

        {/* 台词 / 阶段提示 */}
        <div style={{
          textAlign: 'center',
          minHeight: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}>
          {phaseIdx === 2 ? (
            <>
              <div className="hd-text-mono" style={{
                fontSize: 11,
                color: 'var(--hd-cyan)',
                letterSpacing: '0.35em',
                textShadow: '0 0 8px var(--hd-cyan-glow)',
              }}>
                {captain.callsign}
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '0.05em',
              }}>
                欢迎回来，指挥官
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                letterSpacing: '0.05em',
              }}>
                所有系统已在线，星域正在等待您的指令
              </div>
            </>
          ) : (
            <div className="hd-text-mono hd-text-glow" style={{
              fontSize: 13,
              letterSpacing: '0.3em',
              fontWeight: 600,
            }}>
              ◆ {phase.label}
            </div>
          )}
        </div>

        {/* 进度条 */}
        <div style={{
          width: '100%',
          maxWidth: 400,
          height: 2,
          background: 'rgba(79, 195, 247, 0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, transparent 0%, var(--hd-cyan) 100%)',
            boxShadow: '0 0 8px var(--hd-cyan-glow)',
            transition: 'width 0.15s linear',
          }} />
        </div>

        <div className="hd-text-mono" style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.2em',
          display: 'flex',
          gap: 20,
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: 400,
        }}>
          <span>{Math.round(progress * 100)}% · PHASE {phaseIdx + 1}/{PHASES.length}</span>
          <button
            onClick={skip}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 10,
              letterSpacing: '0.2em',
              padding: 0,
            }}
          >
            SKIP ▸
          </button>
        </div>
      </div>
    </div>
  )
}
