import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { pingRemote } from '@/api/client'

/**
 * 后端不可达时的顶部小横幅（优化版：占用空间小，只在真正无法访问时显示）
 */
export default function RemoteStatusBanner() {
  const nav = useNavigate()
  const [msg, setMsg] = useState<string | null>(null)
  const [reason, setReason] = useState<'timeout' | 'network' | 'other' | null>(null)
  const [checking, setChecking] = useState(false)
  const [failCount, setFailCount] = useState(0) // 连续失败次数

  const check = async () => {
    setChecking(true)
    const r = await pingRemote()
    if (r.ok) {
      setMsg(null)
      setReason(null)
      setFailCount(0)
    } else {
      setFailCount(prev => prev + 1)
      // 连续失败 2 次以上才显示警告（避免瞬时网络抖动误报）
      if (failCount >= 1) {
        if (r.error === '请求超时') {
          setMsg('后端无响应')
          setReason('timeout')
        } else if (r.error?.includes('网络不通')) {
          setMsg('网络不通')
          setReason('network')
        } else {
          setMsg(r.error || '后端不可达')
          setReason('other')
        }
      }
    }
    setChecking(false)
  }

  useEffect(() => {
    check()
    // 每 60s 复检一次（降低频率）
    const t = setInterval(check, 60000)
    return () => clearInterval(t)
  }, [])

  if (!msg) return null

  const isSecurityGroupIssue = reason === 'timeout' || reason === 'network'

  return (
    <div style={{
      background: isSecurityGroupIssue ? '#fef3c7' : '#fee2e2',
      color: isSecurityGroupIssue ? '#78350f' : '#991b1b',
      padding: '8px 12px',
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      borderBottom: `1px solid ${isSecurityGroupIssue ? '#fcd34d' : '#fca5a5'}`
    }}>
      <span>{isSecurityGroupIssue ? '⚠️' : '🔴'}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>
        {msg}
        {isSecurityGroupIssue && <span style={{ opacity: 0.8 }}> - IP 可能不在白名单</span>}
      </span>
      {isSecurityGroupIssue && (
        <button
          onClick={() => nav('/settings/security-groups')}
          style={{
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          更新白名单
        </button>
      )}
      <button
        onClick={check}
        disabled={checking}
        style={{
          background: 'transparent',
          color: isSecurityGroupIssue ? '#78350f' : '#991b1b',
          border: `1px solid ${isSecurityGroupIssue ? '#f59e0b' : '#ef4444'}`,
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          fontWeight: 600,
          cursor: checking ? 'default' : 'pointer',
          opacity: checking ? 0.6 : 1
        }}
      >
        {checking ? '...' : '重试'}
      </button>
    </div>
  )
}
