import { useEffect, useState } from 'react'
import { List, Button, Dialog, Toast, Divider, Selector } from 'antd-mobile'
import { AddOutline, RightOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'
import { useAuth, useTheme } from '@/store'

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

  return (
    <PageShell title="设置">
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 22,
          background: 'var(--accent-blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: 'white', fontWeight: 600
        }}>{(user?.username || 'U')[0].toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{user?.display_name || user?.username}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user?.role || 'operator'}</div>
        </div>
      </div>

      <List header="外观" mode="card">
        <List.Item description="选择主题模式">
          <div style={{ marginTop: 8 }}>
            <Selector
              columns={3}
              value={[themeMode]}
              onChange={v => v[0] && setThemeMode(v[0] as any)}
              options={[
                { label: '🌙 深色', value: 'dark' },
                { label: '☀️ 浅色', value: 'light' },
                { label: '🔄 跟随系统', value: 'auto' }
              ]}
            />
          </div>
        </List.Item>
      </List>

      <List header="数据源" mode="card">
        <List.Item
          extra={`${grafana.length} 个`}
          arrow={<RightOutline />}
          onClick={() => nav('/settings/grafana')}
        >Grafana</List.Item>
        <List.Item
          extra={`${prom.length} 个`}
          arrow={<RightOutline />}
          onClick={() => nav('/settings/prom')}
        >Prometheus</List.Item>
      </List>

      <List header="腾讯云" mode="card">
        <List.Item
          extra={`${cloud.length} 个账号`}
          arrow={<RightOutline />}
          onClick={() => nav('/settings/cloud')}
        >云账号 (AK/SK)</List.Item>
      </List>

      <List header="集群" mode="card">
        <List.Item
          extra={`${clusters.length} 个`}
          arrow={<RightOutline />}
          onClick={() => nav('/settings/clusters')}
        >K8s 集群</List.Item>
      </List>

      <List mode="card">
        <List.Item
          arrow={false}
          onClick={doLogout}
          style={{ '--prefix-width': '0' } as any}
        >
          <span style={{ color: 'var(--danger)' }}>退出登录</span>
        </List.Item>
      </List>

      <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 11, marginTop: 20 }}>
        Mobile-Ops MVP v0.2 · {themeMode === 'auto' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'}
      </div>
    </PageShell>
  )
}
