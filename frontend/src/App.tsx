import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd-mobile'
import zhCN from 'antd-mobile/es/locales/zh-CN'
import { useAuth } from '@/store'

import AppLayout from '@/components/AppLayout'
import LoginPage from '@/pages/Login'
import HomePage from '@/pages/Home'
import MonitorPage from '@/pages/Monitor'
import AlertsPage from '@/pages/Alerts'
import OperationsPage from '@/pages/Operations'
import ScalePage from '@/pages/Scale'
import SettingsPage from '@/pages/Settings'
import GrafanaSettingsPage from '@/pages/settings/GrafanaSettings'
import PromSettingsPage from '@/pages/settings/PromSettings'
import CloudSettingsPage from '@/pages/settings/CloudSettings'
import ClustersSettingsPage from '@/pages/settings/ClustersSettings'
import GrafanaNewPage from '@/pages/settings/GrafanaNew'
import PromNewPage from '@/pages/settings/PromNew'
import CloudNewPage from '@/pages/settings/CloudNew'
import ClusterNewPage from '@/pages/settings/ClusterNew'
import ClusterEditPage from '@/pages/settings/ClusterEdit'

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuth(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* 独立表单页 & 向导（无底部 TabBar） */}
          <Route path="/scale" element={<Protected><ScalePage /></Protected>} />
          <Route path="/settings/grafana" element={<Protected><GrafanaSettingsPage /></Protected>} />
          <Route path="/settings/grafana/new" element={<Protected><GrafanaNewPage /></Protected>} />
          <Route path="/settings/prom" element={<Protected><PromSettingsPage /></Protected>} />
          <Route path="/settings/prom/new" element={<Protected><PromNewPage /></Protected>} />
          <Route path="/settings/cloud" element={<Protected><CloudSettingsPage /></Protected>} />
          <Route path="/settings/cloud/new" element={<Protected><CloudNewPage /></Protected>} />
          <Route path="/settings/clusters" element={<Protected><ClustersSettingsPage /></Protected>} />
          <Route path="/settings/clusters/new" element={<Protected><ClusterNewPage /></Protected>} />
          <Route path="/settings/clusters/:id/edit" element={<Protected><ClusterEditPage /></Protected>} />

          {/* 主界面（含底部 TabBar） */}
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route path="/" element={<HomePage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
