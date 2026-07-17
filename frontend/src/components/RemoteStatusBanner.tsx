import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pingRemote } from '@/api/client'

/**
 * 后端不可达时的醒目警告卡片
 * 用于登录页/首页，让 APK 在后端 500 / 安全组未放开时也能友好展示
 */
export default function RemoteStatusBanner() {
  const nav = useNavigate()
  const [msg, setMsg] = useState<string | null>(null)
  const [reason, setReason] = useState<'timeout' | 'network' | 'other' | null>(null)
  const [checking, setChecking] = useState(false)

  const check = async () => {
    setChecking(true)
    const r = await pingRemote()
    if (r.ok) {
      setMsg(null)
      setReason(null)
    } else if (r.error === '请求超时') {
      setMsg('后端无响应')
      setReason('timeout')
    } else if (r.error?.includes('网络不通')) {
      setMsg('网络不通')
      setReason('network')
    } else {
      setMsg(r.error || '后端不可达')
      setReason('other')
    }
    setChecking(false)
  }

  useEffect(() => {
    check()
    // 每 30s 复检一次，让用户放开安全组后能自动恢复
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [])

  if (!msg) return null

  const isSecurityGroupIssue = reason === 'timeout' || reason === 'network'

  return (
    <div style={{
      marginBottom: 16,
      borderRadius: 16,
      background: isSecurityGroupIssue
        ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
        : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
      color: 'white',
      padding: 18,
      boxShadow: isSecurityGroupIssue
        ? '0 8px 24px rgba(234, 88, 12, 0.35)'
        : '0 8px 24px rgba(220, 38, 38, 0.35)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 装饰性背景圆 */}
      <div style={{
        position: 'absolute',
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)'
      }}/>
      <div style={{
        position: 'absolute',
        bottom: -30,
        left: -30,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.08)'
      }}/>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* 标题行 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20
          }}>
            {isSecurityGroupIssue ? '🔒' : '⚠️'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{msg}</div>
            {isSecurityGroupIssue && (
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>
                你的IP可能不在安全组白名单中
              </div>
            )}
          </div>
        </div>

        {/* 说明文字 */}
        {isSecurityGroupIssue && (
          <div style={{
            fontSize: 12,
            lineHeight: 1.6,
            opacity: 0.95,
            marginBottom: 12,
            paddingLeft: 48
          }}>
            云服务器需要把你的公网IP加入安全组白名单才能访问。点击下方按钮一键更新。
          </div>
        )}

        {/* 行动按钮 */}
        <div style={{
          display: 'flex',
          gap: 8,
          paddingLeft: 48
        }}>
          {isSecurityGroupIssue && (
            <button
              onClick={() => nav('/settings/security-groups')}
              style={{
                flex: 1,
                background: 'white',
                color: '#ea580c',
                border: 'none',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              🔓 更新安全组白名单
            </button>
          )}
          <button
            onClick={check}
            disabled={checking}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: checking ? 'default' : 'pointer',
              opacity: checking ? 0.6 : 1,
              minWidth: 72
            }}
          >
            {checking ? '检测中...' : '🔄 重试'}
          </button>
        </div>
      </div>
    </div>
  )
}
