import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  user: any | null
  setAuth: (token: string, user: any) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    set => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('mobile_ops_token', token)
        set({ token, user })
      },
      logout: () => {
        localStorage.removeItem('mobile_ops_token')
        // 主动登出时清除"记住密码"凭据,避免被踢回登录页后又被自动登录进来
        localStorage.removeItem('mobile_ops_saved_credentials')
        set({ token: null, user: null })
      }
    }),
    { name: 'mobile-ops-auth' }
  )
)

interface UIState {
  activeClusterId: number | null
  setActiveCluster: (id: number | null) => void
}

export const useUI = create<UIState>(set => ({
  activeClusterId: null,
  setActiveCluster: id => set({ activeClusterId: id })
}))

// 主题
export type ThemeMode = 'dark' | 'light' | 'auto' | 'pure-black'

interface ThemeState {
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
}

export const useTheme = create<ThemeState>()(
  persist(
    set => ({
      mode: 'dark',
      setMode: m => set({ mode: m })
    }),
    { name: 'mobile-ops-theme' }
  )
)

// 计算真实主题（auto 时看系统偏好）
export function resolveTheme(mode: ThemeMode): 'dark' | 'light' | 'pure-black' {
  if (mode === 'auto') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

// 应用主题到 <html data-theme="xxx"> 和 body class
export function applyTheme(mode: ThemeMode) {
  const actual = resolveTheme(mode)
  document.documentElement.setAttribute('data-theme', actual)
  document.documentElement.setAttribute('data-prefers-color-scheme', actual === 'pure-black' ? 'dark' : actual)

  // 清理旧 class
  document.documentElement.classList.remove('light-theme', 'pure-black-theme')
  document.body.classList.remove('mo-dark', 'mo-light', 'mo-pure-black')

  // 用 html class 控制（优先级高于 body）
  if (actual === 'dark') {
    document.body.classList.add('mo-dark')
  } else if (actual === 'pure-black') {
    document.documentElement.classList.add('pure-black-theme')
    document.body.classList.add('mo-pure-black')
  } else {
    document.documentElement.classList.add('light-theme')
    document.body.classList.add('mo-light')
  }
  // 更新 theme-color meta（PWA 状态栏颜色）
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  if (metaTheme) {
    const color = actual === 'pure-black' ? '#000000' : actual === 'dark' ? '#1F2329' : '#F5F6F7'
    metaTheme.setAttribute('content', color)
  }
}
