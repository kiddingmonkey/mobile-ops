import { useEffect, useState } from 'react'
import { NavBar, Card, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api, friendlyApiError } from '@/api/client'

export default function DialingSettingsPage() {
  const nav = useNavigate()
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDialingTokenStatus().then(r => {
      setStatus(r)
      setLoading(false)
    }).catch(e => {
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="page">
        <NavBar onBack={() => nav(-1)}>拨测平台配置</NavBar>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中...</div>
      </div>
    )
  }

  return (
    <div className="page">
      <NavBar onBack={() => nav(-1)}>拨测平台配置</NavBar>
      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>

        {/* Token 状态卡片 */}
        <Card title="Token 状态" style={{ marginBottom: 16 }}>
          {status?.status === 'ok' ? (
            <>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>签发时间：</span>
                {new Date(status.issuedAt).toLocaleString('zh-CN')}
              </div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>过期时间：</span>
                {new Date(status.expireAt).toLocaleString('zh-CN')}
              </div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>剩余天数：</span>
                <span style={{ color: status.needRefresh ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                  {status.remainingDays} 天
                </span>
              </div>
              {status.needRefresh && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 6, padding: 8, marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>
                  ⚠️ Token 即将过期，请尽快刷新
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {status?.message || 'Token 状态异常'}
            </div>
          )}
        </Card>

        {/* 刷新引导卡片 */}
        <Card title="如何刷新 Token" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <div style={{ marginBottom: 12 }}>
              1. 在电脑浏览器打开 <a href="http://monitor.zhixue.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>monitor.zhixue.com</a>
            </div>
            <div style={{ marginBottom: 12 }}>
              2. 使用 <b>haowu33</b> 账号登录
            </div>
            <div style={{ marginBottom: 12 }}>
              3. 打开浏览器开发者工具（F12）→ Network 标签
            </div>
            <div style={{ marginBottom: 12 }}>
              4. 刷新页面，找到任意请求的 Request Headers
            </div>
            <div style={{ marginBottom: 12 }}>
              5. 复制 <b>token</b> 字段的值（以 <code style={{ background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: 3 }}>eyJhbG...</code> 开头的长字符串）
            </div>
            <div style={{ marginBottom: 12 }}>
              6. SSH 登录服务器 <code style={{ background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: 3 }}>10.211.79.100</code>
            </div>
            <div style={{ marginBottom: 12 }}>
              7. 编辑配置文件：<code style={{ background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: 3, fontSize: 11 }}>vim /data2/haowu33/mobile/backend/config.yaml</code>
            </div>
            <div style={{ marginBottom: 12 }}>
              8. 找到 <code style={{ background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: 3 }}>dialing.token</code>，替换为新 token
            </div>
            <div>
              9. 重启服务：<code style={{ background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: 3 }}>systemctl restart mobile-ops</code>
            </div>
          </div>
        </Card>

        <Button block color="primary" onClick={() => { window.open('http://monitor.zhixue.com', '_blank') }}>
          前往智学网拨测平台
        </Button>
      </div>
    </div>
  )
}

