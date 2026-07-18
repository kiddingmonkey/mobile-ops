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
import DiagnosePage from '@/pages/Diagnose'
import TasksPage from '@/pages/Tasks'
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
import OTADebug from '@/pages/settings/OTADebug'
import UpdateChecker from '@/components/UpdateChecker'

const CURRENT_VERSION_KEY = 'mobile_ops_dist_version'
const WEBROOT_DIR = 'webroot'
const HEALTH_CHECK_KEY = 'mobile_ops_health_check'
const HEALTH_CHECK_TIMEOUT = 10000 // 10秒

// 启动健康检查：检测到异常启动则自动回退
function startupHealthCheck() {
  if (!Capacitor.isNativePlatform()) return

  const lastCheck = localStorage.getItem(HEALTH_CHECK_KEY)
  const now = Date.now()

  // 如果上次检查时间在 10 秒内，说明 App 刚启动就崩溃/重启了
  if (lastCheck && now - parseInt(lastCheck) < HEALTH_CHECK_TIMEOUT) {
    console.error('[OTA] 检测到异常启动循环，清除 OTA 数据回退到 builtin 版本')

    // 清除所有 OTA 相关数据
    localStorage.removeItem(CURRENT_VERSION_KEY)
    localStorage.removeItem('OTA_RESTART_PENDING')
    localStorage.removeItem(HEALTH_CHECK_KEY)

    // 尝试删除 webroot 目录（异步，不阻塞启动）
    Filesystem.rmdir({
      path: WEBROOT_DIR,
      directory: Directory.Data,
      recursive: true
    }).catch(err => {
      console.warn('[OTA] 清理 webroot 目录失败（可能不存在）:', err)
    })

    // 显示 Toast 提示用户
    alert('检测到更新异常，已自动回退到内置版本')

    return
  }

  // 记录本次启动时间
  localStorage.setItem(HEALTH_CHECK_KEY, now.toString())

  // 5 秒后清除检查标记（说明启动成功）
  setTimeout(() => {
    localStorage.removeItem(HEALTH_CHECK_KEY)
    console.log('[OTA] 启动健康检查通过')
  }, 5000)
}

// 在 App 启动时恢复热更新版本
async function restoreUpdatedVersion() {
  if (!Capacitor.isNativePlatform()) return

  const savedVersion = localStorage.getItem(CURRENT_VERSION_KEY)
  if (!savedVersion || savedVersion === 'builtin') return

  // 不再调用 setServerBasePath，Capacitor 会自动检测
  // setServerBasePath 可能导致 WebView 死锁或路径错误
  console.log(`[OTA] 跳过 setServerBasePath，Capacitor 会自动检测版本: ${savedVersion}`)

  // 仅验证文件是否存在，如果不存在则清除版本记录
  try {
    const versionDir = `${WEBROOT_DIR}/${savedVersion}`
    await Filesystem.stat({
      path: versionDir,
      directory: Directory.Data
    })
    console.log(`[OTA] 版本目录存在: ${versionDir}`)
  } catch (err) {
    console.error('[OTA] 版本目录不存在，清除版本记录:', err)
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
    // 最先进行健康检查，检测异常启动循环
    startupHealthCheck()

    // 检查是否是 OTA 更新后重启
    const restartPending = localStorage.getItem('OTA_RESTART_PENDING')
    if (restartPending) {
      // 清除标记
      localStorage.removeItem('OTA_RESTART_PENDING')
      const savedVersion = localStorage.getItem(CURRENT_VERSION_KEY)
      console.log(`[OTA] 检测到更新后重启，当前版本: ${savedVersion}`)
      // Toast 提示用户更新成功（可选，避免打扰）
    }

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
          <Route path="/settings/ota-debug" element={<Protected><OTADebug /></Protected>} />
          {/* 安全组页面：支持未登录访问（只需要公网IP和腾讯云API，不依赖后端） */}
          <Route path="/settings/security-groups" element={<SecurityGroupsPage />} />
          <Route path="/settings/security-groups/new" element={<Protected><SecurityGroupNewPage /></Protected>} />

          {/* 主界面（含底部 TabBar） */}
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route path="/" element={<HomePage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/diagnose" element={<DiagnosePage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* 保留旧路由兼容 */}
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/logs" element={<LogsPage />} />
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
