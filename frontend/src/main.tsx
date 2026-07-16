import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import 'antd-mobile/es/global'
import { applyTheme, useTheme } from './store'
import { loadBuiltinVersion } from './utils/version'

// 启动时预加载 version.json (fetch 失败会自动兜底,不阻塞)
loadBuiltinVersion()

// 启动时应用已保存的主题
applyTheme(useTheme.getState().mode)

// 订阅主题变化
useTheme.subscribe(state => applyTheme(state.mode))

// auto 模式下监听系统主题变化
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useTheme.getState().mode === 'auto') applyTheme('auto')
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
