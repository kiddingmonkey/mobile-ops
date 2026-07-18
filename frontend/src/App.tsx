import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd-mobile'
import zhCN from 'antd-mobile/es/locales/zh-CN'
import { useAuth } from '@/store'
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { App as CapApp } from '@capacitor/app'
import { initNotifications, setupNotificationChannels } from '@/utils/alertNotifier'

import ErrorBoundary from '@/components/ErrorBoundary'
import AppLayout from '@/components/AppLayout'
import Onboarding from '@/components/Onboarding'
import LoginPage from '@/pages/Login'
import HomePage from '@/pages/Home'
import MonitorPage from '@/pages/Monitor'
import AlertsPage from '@/pages/Alerts'
import OperationsPage from '@/pages/Operations'
import LogsPage from '@/pages/Logs'
import ScalePage from '@/pages/Scale'
import SettingsPage from '@/pages/Settings'
import ClusterResourcesPage from '@/pages/ClusterResources'
import PodDetailPage from '@/pages/PodDetail'
import ResourceDetailPage from '@/pages/ResourceDetail'
import NodePoolDetailPage from '@/pages/NodePoolDetail'
import GrafanaSettingsPage from '@/pages/settings/GrafanaSettings'
import SecurityGroupsPage from '@/pages/settings/SecurityGroups'
import SecurityGroupNewPage from '@/pages/settings/SecurityGroupNew'
import PromSettingsPage from '@/pages/settings/PromSettings'
import CloudSettingsPage from '@/pages/settings/CloudSettings'
import ClustersSettingsPage from '@/pages/settings/ClustersSettings'
import GrafanaNewPage from '@/pages/settings/GrafanaNew'
import PromNewPage from '@/pages/settings/PromNew'
import CloudNewPage from '@/pages/settings/CloudNew'
import ClusterNewPage from '@/pages/settings/ClusterNew'
import ClusterEditPage from '@/pages/settings/ClusterEdit'
import NotificationSettings from '@/pages/settings/NotificationSettings'
import UpdateChecker from '@/components/UpdateChecker'

const CURRENT_VERSION_KEY = 'mobile_ops_dist_version'
const WEBROOT_DIR = 'webroot'

// 在 App 启动时恢复热更新版本
async function restoreUpdatedVersion() {
  if (!Capacitor.isNativePlatform()) return

  const savedVersion = localStorage.getItem(CURRENT_VERSION_KEY)
  if (!savedVersion || savedVersion === 'builtin') return

  try {
    // 获取更新后的资源目录
    const versionDir = `${WEBROOT_DIR}/${savedVersion}`
    const uri = await Filesystem.getUri({
      path: versionDir,
      directory: Directory.Data
    })
    const absPath = uri.uri.replace(/^file:\/\//, '')

    // 重新设置 WebView 基础路径
    const { WebView } = await import('@capacitor/core')
    if (WebView && typeof (WebView as any).setServerBasePath === 'function') {
      await (WebView as any).setServerBasePath({ path: absPath })
      console.log(`[OTA] Restored version ${savedVersion} from ${absPath}`)
    }
  } catch (err) {
    console.error('[OTA] Failed to restore updated version:', err)
    // 如果恢复失败，清除版本记录，避免无限循环
    localStorage.removeItem(CURRENT_VERSION_KEY)
  }
}

// 处理Android返回按钮
function setupBackButtonHandler() {
  if (!Capacitor.isNativePlatform()) return

  CapApp.addListener('backButton', (event: { canGoBack: boolean }) => {
    // 如果WebView可以返回（有历史记录），则返回上一页
    if (event.canGoBack) {
      window.history.back()
    }
    // 否则什么都不做，防止退出App
    // 用户需要通过Home键或任务管理器退出
  })
}

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuth(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('mobile_ops_onboarding_done')
  })

  useEffect(() => {
    restoreUpdatedVersion()
    setupBackButtonHandler()

    // 初始化通知系统
    if (Capacitor.isNativePlatform()) {
      setupNotificationChannels().then(() => {
        initNotifications().catch(err => {
          console.error('[App] Failed to init notifications:', err)
        })
      })
    }
  }, [])

  const finishOnboarding = () => {
    localStorage.setItem('mobile_ops_onboarding_done', '1')
    setShowOnboarding(false)
  }

  if (showOnboarding) {
    return (
      <ErrorBoundary>
        <ConfigProvider locale={zhCN}>
          <Onboarding onFinish={finishOnboarding} />
        </ConfigProvider>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
    <ConfigProvider locale={zhCN}>
      <UpdateChecker />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* 独立表单页 & 向导（无底部 TabBar） */}
          <Route path="/scale" element={<Protected><ScalePage /></Protected>} />
          <Route path="/clusters/:id/resources" element={<Protected><ClusterResourcesPage /></Protected>} />
          <Route path="/clusters/:clusterId/pods/:namespace/:name" element={<Protected><PodDetailPage /></Protected>} />
          <Route path="/clusters/:clusterId/resources/:resourceType/:namespace/:name" element={<Protected><ResourceDetailPage /></Protected>} />
          <Route path="/clusters/:clusterId/node-pools/:poolId" element={<Protected><NodePoolDetailPage /></Protected>} />
          <Route path="/settings/grafana" element={<Protected><GrafanaSettingsPage /></Protected>} />
          <Route path="/settings/grafana/new" element={<Protected><GrafanaNewPage /></Protected>} />
          <Route path="/settings/prom" element={<Protected><PromSettingsPage /></Protected>} />
          <Route path="/settings/prom/new" element={<Protected><PromNewPage /></Protected>} />
          <Route path="/settings/cloud" element={<Protected><CloudSettingsPage /></Protected>} />
          <Route path="/settings/cloud/new" element={<Protected><CloudNewPage /></Protected>} />
          <Route path="/settings/clusters" element={<Protected><ClustersSettingsPage /></Protected>} />
          <Route path="/settings/clusters/new" element={<Protected><ClusterNewPage /></Protected>} />
          <Route path="/settings/clusters/:id/edit" element={<Protected><ClusterEditPage /></Protected>} />
          <Route path="/settings/notifications" element={<Protected><NotificationSettings /></Protected>} />
          {/* 安全组页面：支持未登录访问（只需要公网IP和腾讯云API，不依赖后端） */}
          <Route path="/settings/security-groups" element={<SecurityGroupsPage />} />
          <Route path="/settings/security-groups/new" element={<Protected><SecurityGroupNewPage /></Protected>} />

          {/* 主界面（含底部 TabBar） */}
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route path="/" element={<HomePage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* 独立页面（无底部 TabBar） */}
          <Route path="/operations" element={<Protected><OperationsPage /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
    </ErrorBoundary>
  )
}
