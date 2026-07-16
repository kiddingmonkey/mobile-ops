import { useEffect, useState } from 'react'
import { pingRemote } from '@/api/client'

/**
 * 顶部横幅：远程后端不可达时提示用户
 * 用于登录页/首页，让 APK 在后端 500 / 安全组未放开时也能友好展示
 */
export default function RemoteStatusBanner() {
  const [msg, setMsg] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const check = async () => {
    setChecking(true)
    const r = await pingRemote()
    setMsg(r.ok ? null : (r.error || '后端不可达'))
    setChecking(false)
  }

  useEffect(() => {
    check()
    // 每 30s 复检一次，让用户放开安全组后能自动恢复
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [])

  if (!msg) return null

  return (
    <div style={{
      background: 'rgba(248, 113, 113, 0.15)',
      borderLeft: '3px solid #F87171',
      color: '#FCA5A5',
      padding: '10px 14px',
      fontSize: 12,
      lineHeight: 1.5,
      display: 'flex', alignItems: 'center', gap: 10
    }}>
      <span style={{ fontSize: 16 }}>⚠️</span>
      <div style={{ flex: 1 }}>{msg}</div>
      <span
        onClick={check}
        style={{
          fontSize: 11, opacity: checking ? 0.4 : 1,
          textDecoration: 'underline', cursor: 'pointer'
        }}
      >{checking ? '检测中' : '重试'}</span>
    </div>
  )
}
