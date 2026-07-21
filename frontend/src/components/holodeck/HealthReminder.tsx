import { useEffect, useState } from 'react'

/**
 * 45 分钟提醒
 * - 从进入 Holodeck 模式开始计时
 * - 紧急模式（body.hd-emergency）暂停
 * - 关闭后重新计时
 */

const INTERVAL_MS = 45 * 60 * 1000
const LAST_KEY = 'holodeck_health_last'

const TIPS = [
  { title: '起身舒展', body: '连续凝视星图 45 分钟了。站起来伸个懒腰，让眼睛看看远方。' },
  { title: '补充水分', body: '指挥官，能量储备偏低。喝一口水，让大脑重新在线。' },
  { title: '深呼吸 3 次', body: '数据流很稳，你也可以稳。三次腹式呼吸，专注当下。' },
  { title: '眺望窗外', body: '20 秒规则：看向 6 米外的物体 20 秒，让睫状肌放松。' },
  { title: '揉揉肩颈', body: '肩胛骨向后转 5 圈，头缓慢左右各转 3 次。' },
]

export default function HealthReminder({ emergency }: { emergency: boolean }) {
  const [show, setShow] = useState(false)
  const [tipIdx] = useState(() => Math.floor(Math.random() * TIPS.length))

  useEffect(() => {
    const check = () => {
      if (emergency) return
      const last = parseInt(localStorage.getItem(LAST_KEY) || '0')
      const now = Date.now()
      if (!last) {
        localStorage.setItem(LAST_KEY, String(now))
        return
      }
      if (now - last >= INTERVAL_MS) {
        setShow(true)
      }
    }
    check()
    const t = setInterval(check, 60 * 1000)
    return () => clearInterval(t)
  }, [emergency])

  if (!show || emergency) return null

  const tip = TIPS[tipIdx]

  const dismiss = () => {
    localStorage.setItem(LAST_KEY, String(Date.now()))
    setShow(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        right: 20,
        maxWidth: 320,
        zIndex: 9990,
        animation: 'hd-breathe 4s ease-in-out infinite',
      }}
    >
      <div
        className="hd-panel"
        style={{
          padding: 0,
          borderColor: 'rgba(74, 222, 128, 0.35)',
        }}
      >
        <div
          className="hd-panel-header"
          style={{ color: 'var(--success)', textShadow: '0 0 8px rgba(74,222,128,0.5)' }}
        >
          <span>◇ WELLNESS</span>
          <button
            onClick={dismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 0,
              fontSize: 14,
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

        <div style={{ padding: '12px 14px 14px' }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}>
            {tip.title}
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: 12,
          }}>
            {tip.body}
          </div>
          <button
            className="hd-btn"
            onClick={dismiss}
            style={{ width: '100%', fontSize: 11 }}
          >
            KNOW · 已收到
          </button>
        </div>
      </div>
    </div>
  )
}
