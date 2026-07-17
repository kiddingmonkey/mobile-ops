import { useEffect, useRef, useState } from 'react'
import { Button, Toast, Selector, Dialog } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api, friendlyApiError } from '@/api/client'
import { useAuth } from '@/store'
import RemoteStatusBanner from '@/components/RemoteStatusBanner'

// APK WebView + 国产输入法下 antd-mobile Input 的 onChange 有时不同步,
// 用原生 <input> + ref 直读 DOM 值,规避 state 与 DOM 不一致导致的 "请输入密码"

const CRED_KEY = 'mobile_ops_saved_credentials'
type RememberOption = 'off' | '7d' | '30d'
const DAYS: Record<RememberOption, number> = { off: 0, '7d': 7, '30d': 30 }

interface SavedCred { u: string; p: string; exp: number; days: number }

// 简单 base64 混淆,避免 localStorage 里明文可读; 不是加密,只是防手抖泄露
const obfuscate = (s: string) => btoa(encodeURIComponent(s))
const deobfuscate = (s: string) => { try { return decodeURIComponent(atob(s)) } catch { return '' } }

function loadCred(): SavedCred | null {
  try {
    const raw = localStorage.getItem(CRED_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (!obj || typeof obj.exp !== 'number') return null
    if (Date.now() > obj.exp) {
      localStorage.removeItem(CRED_KEY)
      return null
    }
    return { u: deobfuscate(obj.u), p: deobfuscate(obj.p), exp: obj.exp, days: obj.days || 0 }
  } catch { return null }
}
function saveCred(u: string, p: string, days: number) {
  if (days <= 0) { localStorage.removeItem(CRED_KEY); return }
  const exp = Date.now() + days * 24 * 60 * 60 * 1000
  localStorage.setItem(CRED_KEY, JSON.stringify({ u: obfuscate(u), p: obfuscate(p), exp, days }))
}

export default function LoginPage() {
  const nav = useNavigate()
  const setAuth = useAuth(s => s.setAuth)
  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState<RememberOption>('7d')
  const [autoTried, setAutoTried] = useState(false)
  const [myIP, setMyIP] = useState<string>('获取中...')

  // 获取当前IP（不需要登录）
  useEffect(() => {
    fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
      .then(resp => resp.json())
      .then(data => setMyIP(data.ip || '未知'))
      .catch(() => setMyIP('获取失败'))
  }, [])

  const doLogin = async (username: string, password: string, silent = false) => {
    setLoading(true)
    try {
      const r = await api.login(username, password)
      setAuth(r.token, r.user)
      saveCred(username, password, DAYS[remember])
      if (!silent) Toast.show({ content: '登录成功', icon: 'success' })
      nav('/', { replace: true })
      return true
    } catch (e: any) {
      // 自动登录静默失败:密码可能改了,清凭据回到手动
      if (silent && e?.response?.status === 401) {
        localStorage.removeItem(CRED_KEY)
      } else {
        Toast.show({ content: friendlyApiError(e), icon: 'fail', duration: 3000 })
      }
      return false
    } finally {
      setLoading(false)
    }
  }

  const submit = () => {
    const username = userRef.current?.value?.trim() || ''
    const password = passRef.current?.value || ''
    if (!username || !password) {
      Toast.show({ content: '请填账号密码', icon: 'fail' })
      return
    }
    doLogin(username, password, false)
  }

  // 挂载时尝试自动登录
  useEffect(() => {
    if (autoTried) return
    setAutoTried(true)
    const c = loadCred()
    if (!c) return
    // 回填输入框,选项恢复
    if (userRef.current) userRef.current.value = c.u
    if (passRef.current) passRef.current.value = c.p
    const opt = (Object.keys(DAYS) as RememberOption[]).find(k => DAYS[k] === c.days) || '7d'
    setRemember(opt)
    doLogin(c.u, c.p, true)
  }, [])

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '14px 16px',
    fontSize: 16,
    lineHeight: '22px',
    color: 'var(--text-primary)',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    outline: 'none',
    WebkitAppearance: 'none',
    caretColor: 'var(--accent-blue)'
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

      {/* 右上角安全组按钮 */}
      <div style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top) + 12px)',
        right: 24,
        zIndex: 10
      }}>
        <Button
          size="small"
          color="primary"
          fill="outline"
          onClick={() => nav('/settings/security-groups')}
          style={{ fontSize: 12 }}
        >
          🔐 安全组
        </Button>
      </div>

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

      {/* 表单 —— 用原生 input 非受控，直读 ref */}
      <form onSubmit={(e) => { e.preventDefault(); submit() }} style={{ flex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
            账号
          </div>
          <input
            ref={userRef}
            type="text"
            defaultValue="admin"
            placeholder="admin"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
            密码
          </div>
          <input
            ref={passRef}
            type="password"
            placeholder="••••••"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={inputStyle}
          />
        </div>

        {/* 记住密码选项 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
            记住密码
          </div>
          <Selector
            options={[
              { label: '不记住', value: 'off' },
              { label: '7 天', value: '7d' },
              { label: '30 天', value: '30d' }
            ]}
            value={[remember]}
            onChange={(arr) => arr[0] && setRemember(arr[0] as RememberOption)}
            style={{ '--border-radius': '10px', '--padding': '8px 12px' } as any}
          />
        </div>

        <button type="submit" style={{ display: 'none' }} aria-hidden />
      </form>

      {/* 底部按钮区 */}
      <div>
        {/* 当前IP显示 */}
        {myIP !== '获取中...' && myIP !== '获取失败' && (
          <div style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 12,
            color: 'white'
          }}>
            <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 4 }}>当前公网 IP</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
              {myIP}
            </div>
            <div style={{ fontSize: 11, marginTop: 8, opacity: 0.85, lineHeight: 1.5 }}>
              ⚠️ 如果无法登录，可能是IP不在安全组白名单中
              <br />
              <span
                style={{ textDecoration: 'underline', cursor: 'pointer' }}
                onClick={() => {
                  Dialog.alert({
                    title: '安全组白名单',
                    content: (
                      <div style={{ fontSize: 13, textAlign: 'left', lineHeight: 1.6 }}>
                        <p>当前IP <b>{myIP}</b> 可能不在服务器安全组白名单中。</p>
                        <p style={{ marginTop: 8 }}>请按以下步骤操作：</p>
                        <ol style={{ paddingLeft: 20, margin: '8px 0' }}>
                          <li>登录腾讯云控制台</li>
                          <li>进入「轻量应用服务器」或「云服务器」</li>
                          <li>找到你的服务器，进入「防火墙」或「安全组」</li>
                          <li>添加入站规则：
                            <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: 4 }}>
                              <li>• 来源：<b>{myIP}/32</b></li>
                              <li>• 端口：<b>18443</b></li>
                              <li>• 协议：<b>TCP</b></li>
                            </ul>
                          </li>
                          <li>保存后等待10秒生效，重新登录</li>
                        </ol>
                        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                          💡 登录成功后，可在「设置 → 安全组白名单」中一键更新
                        </p>
                      </div>
                    ),
                    confirmText: '我知道了'
                  })
                }}
              >
                点击查看解决方案
              </span>
            </div>
          </div>
        )}

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
