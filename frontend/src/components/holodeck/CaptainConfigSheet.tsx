import { useRef, useState } from 'react'
import { SILHOUETTES, SilhouetteId } from './CaptainSilhouettes'

interface CaptainConfig {
  name: string
  callsign: string
  silhouette?: SilhouetteId
  portraitUrl?: string
}

export default function CaptainConfigSheet({
  current,
  onSave,
  onClose,
}: {
  current: CaptainConfig
  onSave: (next: CaptainConfig) => void
  onClose: () => void
}) {
  const [name, setName] = useState(current.name)
  const [callsign, setCallsign] = useState(current.callsign)
  const [silhouette, setSilhouette] = useState<SilhouetteId>(current.silhouette || 'lyra')
  const [portraitUrl, setPortraitUrl] = useState<string | undefined>(current.portraitUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = (f: File) => {
    if (f.size > 2 * 1024 * 1024) {
      alert('图片过大（>2MB），请压缩后再上传')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPortraitUrl(reader.result as string)
    reader.readAsDataURL(f)
  }

  const handleSelectPreset = (id: SilhouetteId) => {
    const s = SILHOUETTES[id]
    setSilhouette(id)
    setPortraitUrl(undefined)
    if (name === current.name && current.silhouette && SILHOUETTES[current.silhouette]?.name === name) {
      setName(s.name)
      setCallsign(s.callsign)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 5, 16, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 9998,
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
          maxWidth: 720,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 0,
        }}
      >
        <div className="hd-panel-header">
          <span>◆ CAPTAIN CUSTOMIZATION</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 16,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div className="hd-panel-corner tl" />
        <div className="hd-panel-corner tr" />
        <div className="hd-panel-corner bl" />
        <div className="hd-panel-corner br" />

        <div style={{ padding: '16px 20px' }}>
          {/* 4 套预设 */}
          <div style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'var(--hd-cyan)',
            marginBottom: 10,
          }}>
            ◇ PRESET SILHOUETTES
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            marginBottom: 20,
          }}>
            {(Object.keys(SILHOUETTES) as SilhouetteId[]).map(id => {
              const s = SILHOUETTES[id]
              const Comp = s.Component
              const selected = silhouette === id && !portraitUrl
              return (
                <div
                  key={id}
                  onClick={() => handleSelectPreset(id)}
                  style={{
                    background: selected ? 'rgba(79, 195, 247, 0.15)' : 'rgba(10, 20, 45, 0.5)',
                    border: `1.5px solid ${selected ? 'var(--hd-cyan)' : 'rgba(120, 200, 255, 0.2)'}`,
                    padding: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 2,
                    boxShadow: selected ? '0 0 16px var(--hd-cyan-glow)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ height: 130, width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <Comp />
                  </div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: selected ? 'var(--hd-cyan)' : 'var(--text-primary)',
                    textAlign: 'center',
                    letterSpacing: '0.05em',
                  }}>
                    {s.name}
                  </div>
                  <div className="hd-text-mono" style={{
                    fontSize: 9,
                    color: 'var(--text-tertiary)',
                    textAlign: 'center',
                  }}>
                    {s.desc}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 自定义立绘上传 */}
          <div style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'var(--hd-cyan)',
            marginBottom: 10,
          }}>
            ◇ CUSTOM PORTRAIT
          </div>
          <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 20,
            alignItems: 'center',
          }}>
            <div style={{
              width: 80,
              height: 130,
              border: '1.5px dashed rgba(120, 200, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              background: 'rgba(10, 20, 45, 0.5)',
              flexShrink: 0,
            }}>
              {portraitUrl ? (
                <img src={portraitUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.15em' }}>
                  NO IMAGE
                </span>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="hd-btn"
                onClick={() => fileRef.current?.click()}
                style={{ fontSize: 11 }}
              >
                UPLOAD IMAGE
              </button>
              {portraitUrl && (
                <button
                  className="hd-btn"
                  onClick={() => setPortraitUrl(undefined)}
                  style={{ fontSize: 11 }}
                >
                  REMOVE
                </button>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                建议透明背景 PNG · 竖构图 · &lt;2MB
                <br />
                你可以用 midjourney/nijijourney 生成想要的舰长立绘
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleUpload(f)
                }}
              />
            </div>
          </div>

          {/* 昵称/呼号 */}
          <div style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'var(--hd-cyan)',
            marginBottom: 10,
          }}>
            ◇ IDENTIFICATION
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>NAME</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>CALLSIGN</label>
              <input
                value={callsign}
                onChange={e => setCallsign(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* 底部操作 */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="hd-btn" onClick={onClose}>
              CANCEL
            </button>
            <button
              className="hd-btn"
              onClick={() => onSave({ name, callsign, silhouette, portraitUrl })}
              style={{ background: 'rgba(79, 195, 247, 0.2)' }}
            >
              CONFIRM
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 4,
  background: 'rgba(5, 10, 25, 0.7)',
  border: '1px solid rgba(120, 200, 255, 0.25)',
  color: 'var(--text-primary)',
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  borderRadius: 2,
}
