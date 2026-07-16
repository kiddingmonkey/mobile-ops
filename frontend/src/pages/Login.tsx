import { useState } from 'react'
import { Input, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api, friendlyApiError } from '@/api/client'
import { useAuth } from '@/store'
import RemoteStatusBanner from '@/components/RemoteStatusBanner'

export default function LoginPage() {
  const nav = useNavigate()
  const setAuth = useAuth(s => s.setAuth)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!username || !password) {
      Toast.show({ content: '请填账号密码', icon: 'fail' })
      return
    }
    setLoading(true)
    try {
      const r = await api.login(username, password)
      setAuth(r.token, r.user)
      Toast.show({ content: '登录成功', icon: 'success' })
      nav('/', { replace: true })
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail', duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      padding: 'env(safe-area-inset-top) 24px calc(24px + env(safe-area-inset-bottom))'
    }}>
      <RemoteStatusBanner />
      {/* 顶部品牌区 */}
      <div style={{
        marginTop: 'calc(env(safe-area-inset-top) + 60px)',
        marginBottom: 48,
        textAlign: 'left'
      }}>
        <div style={{
          width: 64, height: 64,
          background: 'linear-gradient(135deg, var(--accent-blue) 0%, #6E9BFF 100%)',
          borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, color: 'white', fontWeight: 700,
          boxShadow: '0 8px 24px rgba(74, 126, 248, 0.3)',
          marginBottom: 24
        }}>⚡</div>
        <h1 className="text-h1" style={{ marginBottom: 6 }}>欢迎回来</h1>
        <div className="text-sm">登录 Mobile-Ops，随时随地掌控你的集群</div>
      </div>

      {/* 表单 */}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
            账号
          </div>
          <Input
            value={username}
            onChange={setUsername}
            placeholder="admin"
            style={{
              '--font-size': '16px',
              padding: '14px 16px',
              background: 'var(--bg-input)',
              borderRadius: 12
            } as any}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
            密码
          </div>
          <Input
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••"
            style={{
              '--font-size': '16px',
              padding: '14px 16px',
              background: 'var(--bg-input)',
              borderRadius: 12
            } as any}
            onEnterPress={submit}
          />
        </div>
      </div>

      {/* 底部按钮区 */}
      <div>
        <Button
          block
          color="primary"
          size="large"
          loading={loading}
          onClick={submit}
          style={{ height: 50, fontSize: 16, borderRadius: 12 }}
        >登 录</Button>
        <div style={{
          marginTop: 20, textAlign: 'center',
          fontSize: 12, color: 'var(--text-tertiary)'
        }}>
          手机运维 · 单手掌控 K8s 集群
        </div>
      </div>
    </div>
  )
}
