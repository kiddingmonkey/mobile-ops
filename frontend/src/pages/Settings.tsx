import { useEffect, useState } from 'react'
import { List, Button, Dialog, Toast, Selector } from 'antd-mobile'
import { RightOutline, InformationCircleOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { api, friendlyApiError } from '@/api/client'
import { useAuth, useTheme } from '@/store'
import { checkForUpdate, downloadAndApply } from '@/utils/otaUpdater'
import { getActiveVersion, versionShort, relTime } from '@/utils/version'

export default function SettingsPage() {
  const nav = useNavigate()
  const logout = useAuth(s => s.logout)
  const user = useAuth(s => s.user)
  const themeMode = useTheme(s => s.mode)
  const setThemeMode = useTheme(s => s.setMode)
  const [grafana, setGrafana] = useState<any[]>([])
  const [prom, setProm] = useState<any[]>([])
  const [cloud, setCloud] = useState<any[]>([])
  const [clusters, setClusters] = useState<any[]>([])

  const load = async () => {
    setGrafana(await api.listGrafana().catch(() => []))
    setProm(await api.listProm().catch(() => []))
    setCloud(await api.listCloudAccounts().catch(() => []))
    setClusters(await api.listClusters().catch(() => []))
  }
  useEffect(() => { load() }, [])

  const doLogout = async () => {
    const ok = await Dialog.confirm({ content: '确认退出登录？' })
    if (ok) { logout(); nav('/login', { replace: true }) }
  }

  const handleCheckUpdate = async () => {
    const th = Toast.show({ content: '检查更新中...', icon: 'loading', duration: 0 })
    const r = await checkForUpdate()
    th.close()

    if (r.error) {
      Toast.show({ content: r.error, icon: 'fail', duration: 3000 })
      return
    }
    if (!r.info) {
      Toast.show({ content: '服务器无更新包', icon: 'fail' })
      return
    }
    if (!r.hasUpdate) {
      Toast.show({ content: `已是最新 (${r.currentVersion.slice(0, 8)})`, icon: 'success' })
      return
    }

    const sizeMB = (r.info.size / 1024 / 1024).toFixed(2)
    const ok = await Dialog.confirm({
      title: '发现新版本',
      content: (
        <div style={{ fontSize: 13 }}>
          <div>当前: {r.currentVersion.slice(0, 8)}</div>
          <div>最新: {r.info.version} ({sizeMB} MB)</div>
          <div style={{ marginTop: 8, color: 'var(--text-tertiary)', fontSize: 11 }}>
            发布于 {new Date(r.info.released_at).toLocaleString()}
          </div>
        </div>
      ),
      confirmText: '立即更新'
    })
    if (!ok) return

    if (!Capacitor.isNativePlatform()) {
      // Web / PWA: 清 SW 缓存 reload,拿新静态资源
      Toast.show({ content: '刷新页面...', icon: 'loading', duration: 800 })
      if ('serviceWorker' in navigator && 'caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      setTimeout(() => window.location.reload(), 800)
      return
    }

    // APK: 下载 + 解压 + 切 WebView
    const progressToast = Toast.show({ content: '下载 0%', icon: 'loading', duration: 0 })
    try {
      await downloadAndApply(r.info, (loaded, total) => {
        const pct = total > 0 ? Math.round((loaded / total) * 100) : 0
        progressToast.close()
        Toast.show({ content: `下载 ${pct}%`, icon: 'loading', duration: 0 })
      })
      // 成功不会走到这里,reload 触发页面重载
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e) || e?.message || '更新失败', icon: 'fail', duration: 4000 })
    }
  }

  return (
    <div className="page">
      <div className="page-header"><span className="title">设置</span></div>
      <div className="page-content">
        {/* 用户卡片 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--accent-blue) 0%, #6E9BFF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: 'white', fontWeight: 700, flexShrink: 0
          }}>{(user?.username || 'U')[0].toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{user?.display_name || user?.username}</div>
            <div className="text-xs" style={{ marginTop: 2 }}>
              {user?.role || 'operator'} · 登录中
            </div>
          </div>
        </div>

        {/* 外观 */}
        <List header="外观" mode="card">
          <List.Item description="选择主题模式">
            <div style={{ marginTop: 8 }}>
              <Selector
                columns={3}
                value={[themeMode]}
                onChange={v => v[0] && setThemeMode(v[0] as any)}
                options={[
                  { label: '深色', value: 'dark' },
                  { label: '浅色', value: 'light' },
                  { label: '跟随系统', value: 'auto' }
                ]}
              />
            </div>
          </List.Item>
        </List>

        {/* 数据源 */}
        <List header="数据源" mode="card">
          <List.Item
            prefix={<StatusDot connected={grafana.length > 0} />}
            extra={`${grafana.length} 个`}
            arrow={<RightOutline />}
            onClick={() => nav('/settings/grafana')}
          >Grafana</List.Item>
          <List.Item
            prefix={<StatusDot connected={prom.length > 0} />}
            extra={`${prom.length} 个`}
            arrow={<RightOutline />}
            onClick={() => nav('/settings/prom')}
          >Prometheus</List.Item>
        </List>

        {/* 云账号 */}
        <List header="云服务" mode="card">
          <List.Item
            prefix={<StatusDot connected={cloud.length > 0} />}
            extra={`${cloud.length} 个账号`}
            arrow={<RightOutline />}
            onClick={() => nav('/settings/cloud')}
          >腾讯云 AK/SK</List.Item>
          <List.Item
            prefix={<span style={{ fontSize: 14 }}>🔐</span>}
            arrow={<RightOutline />}
            onClick={() => nav('/settings/security-groups')}
          >安全组白名单</List.Item>
        </List>

        {/* 集群 */}
        <List header="集群管理" mode="card">
          <List.Item
            prefix={<StatusDot connected={clusters.length > 0} />}
            extra={`${clusters.length} 个`}
            arrow={<RightOutline />}
            onClick={() => nav('/settings/clusters')}
          >K8s 集群</List.Item>
        </List>

        {/* 关于 */}
        <List header="关于" mode="card">
          <List.Item
            extra={versionShort(getActiveVersion())}
            description={
              getActiveVersion().buildTime
                ? `构建于 ${relTime(getActiveVersion().buildTime)} · #${getActiveVersion().runNumber}`
                : undefined
            }
          >当前版本</List.Item>
          <List.Item extra="Capacitor 8">运行环境</List.Item>
          <List.Item onClick={handleCheckUpdate}>检查更新</List.Item>
        </List>

        {/* 退出 */}
        <List mode="card">
          <List.Item
            arrow={false}
            onClick={doLogout}
          ><span style={{ color: 'var(--danger)' }}>退出登录</span></List.Item>
        </List>

        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11, padding: '16px 0 32px' }}>
          Mobile-Ops · 手机运维，单手掌控 K8s 集群
        </div>
      </div>
    </div>
  )
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: connected ? 'var(--success)' : 'var(--text-disabled)',
      boxShadow: connected ? '0 0 4px var(--success)' : 'none'
    }}/>
  )
}
