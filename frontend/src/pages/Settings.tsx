import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, Button, Toast, Selector, SearchBar, Collapse } from 'antd-mobile'
import { RightOutline, DownOutline } from 'antd-mobile-icons'
import { api } from '@/api/client'
import { useTheme, useAuth } from '@/store'
import { getActiveVersion, versionShort, relTime } from '@/utils/version'
import { hapticLight } from '@/utils/haptics'
import { getCurrentVersion } from '@/utils/otaUpdater'
import VersionSelector from '@/components/VersionSelector'

const StatusDot = ({ connected }: { connected: boolean }) => (
  <div style={{
    width: 8, height: 8, borderRadius: '50%',
    background: connected ? 'var(--success)' : 'var(--text-tertiary)'
  }} />
)

/**
 * 设置页 - 极致紧凑版：折叠卡片 + 搜索定位
 */
export default function SettingsPage() {
  const nav = useNavigate()
  const user = useAuth(s => s.user)
  const logout = useAuth(s => s.logout)
  const themeMode = useTheme(s => s.mode)
  const setThemeMode = useTheme(s => s.setMode)

  const [grafana, setGrafana] = useState<any[]>([])
  const [prom, setProm] = useState<any[]>([])
  const [cloud, setCloud] = useState<any[]>([])
  const [clusters, setClusters] = useState<any[]>([])
  const [keyword, setKeyword] = useState('')
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const [showVersionSelector, setShowVersionSelector] = useState(false)

  useEffect(() => {
    api.listGrafana().then(g => setGrafana(g || [])).catch(() => {})
    api.listProm().then(p => setProm(p || [])).catch(() => {})
    api.listCloudAccounts().then(c => setCloud(c || [])).catch(() => {})
    api.listClusters().then(cs => setClusters(cs || [])).catch(() => {})
  }, [])

  const sections = [
    {
      key: 'appearance',
      title: '🎨 外观',
      keywords: ['外观', '主题', '深色', '浅色', 'OLED'],
      render: () => (
        <List.Item description="选择主题模式">
          <div style={{ marginTop: 4 }}>
            <Selector
              columns={2}
              value={[themeMode]}
              onChange={v => v[0] && setThemeMode(v[0] as any)}
              options={[
                { label: '深色', value: 'dark' },
                { label: '浅色', value: 'light' },
                { label: '纯黑 OLED', value: 'pure-black' },
                { label: '跟随系统', value: 'auto' }
              ]}
              style={{ '--border-radius': '6px', '--checked-color': 'var(--accent-blue)' } as any}
            />
          </div>
        </List.Item>
      )
    },
    {
      key: 'datasource',
      title: '📊 数据源',
      keywords: ['数据源', 'Grafana', 'Prometheus'],
      render: () => (
        <List mode="card" style={{ '--border-radius': '8px' } as any}>
          <List.Item
            prefix={<StatusDot connected={grafana.length > 0} />}
            extra={`${grafana.length} 个`}
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); nav('/settings/grafana') }}
          >Grafana</List.Item>
          <List.Item
            prefix={<StatusDot connected={prom.length > 0} />}
            extra={`${prom.length} 个`}
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); nav('/settings/prom') }}
          >Prometheus</List.Item>
          <List.Item
            prefix={<StatusDot connected={true} />}
            extra="监控查询"
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); nav('/settings/vm') }}
          >VictoriaMetrics</List.Item>
          <List.Item
            prefix={<StatusDot connected={true} />}
            extra="告警屏蔽"
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); nav('/settings/alertmanager') }}
          >Alertmanager</List.Item>
          <List.Item
            prefix={<StatusDot connected={true} />}
            extra="分类策略"
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); nav('/settings/alert-filter') }}
          >告警分类</List.Item>
        </List>
      )
    },
    {
      key: 'cloud',
      title: '☁️ 云服务',
      keywords: ['云', '腾讯云', 'AK', 'SK', '安全组', '白名单'],
      render: () => (
        <List mode="card" style={{ '--border-radius': '8px' } as any}>
          <List.Item
            prefix={<StatusDot connected={cloud.length > 0} />}
            extra={`${cloud.length} 个账号`}
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); nav('/settings/cloud') }}
          >腾讯云 AK/SK</List.Item>
          <List.Item
            prefix={<span style={{ fontSize: 14 }}>🔐</span>}
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); nav('/settings/security-groups') }}
          >安全组白名单</List.Item>
        </List>
      )
    },
    {
      key: 'cluster',
      title: '☸️ 集群管理',
      keywords: ['集群', 'K8s', 'Kubernetes'],
      render: () => (
        <List.Item
          prefix={<StatusDot connected={clusters.length > 0} />}
          extra={`${clusters.length} 个`}
          arrow={<RightOutline />}
          onClick={() => { hapticLight(); nav('/settings/clusters') }}
        >K8s 集群</List.Item>
      )
    },
    {
      key: 'notification',
      title: '📢 通知推送',
      keywords: ['通知', '飞书', '企业微信', '告警'],
      render: () => (
        <List.Item
          arrow={<RightOutline />}
          onClick={() => { hapticLight(); nav('/settings/notifications') }}
          description="配置飞书/企业微信"
        >通知渠道</List.Item>
      )
    },
    {
      key: 'history',
      title: '🕒 历史',
      keywords: ['历史', '操作记录'],
      render: () => (
        <List.Item
          arrow={<RightOutline />}
          onClick={() => { hapticLight(); nav('/operations') }}
        >操作记录</List.Item>
      )
    },
    {
      key: 'help',
      title: '❓ 帮助',
      keywords: ['帮助', '手册', '更新日志', '反馈', 'GitHub'],
      render: () => (
        <List mode="card" style={{ '--border-radius': '8px' } as any}>
          <List.Item
            arrow={<RightOutline />}
            onClick={() => window.open('https://github.com/kiddingmonkey/mobile-ops/blob/main/docs/TRAINING.md', '_blank')}
          >📖 使用手册</List.Item>
          <List.Item
            arrow={<RightOutline />}
            onClick={() => window.open('https://github.com/kiddingmonkey/mobile-ops/blob/main/CHANGELOG.md', '_blank')}
          >📝 更新日志</List.Item>
          <List.Item
            arrow={<RightOutline />}
            onClick={() => window.open('https://github.com/kiddingmonkey/mobile-ops/issues/new', '_blank')}
          >💬 问题反馈</List.Item>
          <List.Item
            arrow={<RightOutline />}
            onClick={() => window.open('https://github.com/kiddingmonkey/mobile-ops', '_blank')}
          >⭐ GitHub</List.Item>
        </List>
      )
    },
    {
      key: 'about',
      title: 'ℹ️ 关于',
      keywords: ['关于', '版本', '更新', 'OTA'],
      render: () => (
        <List mode="card" style={{ '--border-radius': '8px' } as any}>
          <List.Item
            extra={versionShort(getActiveVersion())}
            description={
              getActiveVersion().buildTime
                ? `构建 ${relTime(getActiveVersion().buildTime)} · #${getActiveVersion().runNumber}`
                : undefined
            }
          >当前版本</List.Item>
          <List.Item
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); setShowVersionSelector(true) }}
            description="查看版本历史和更新日志"
          >📦 检查更新</List.Item>
          <List.Item
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); nav('/settings/ota-debug') }}
            description="OTA 更新调试日志"
          >🔧 OTA 调试</List.Item>
          <List.Item
            arrow={<RightOutline />}
            onClick={() => { hapticLight(); nav('/settings/input-debug') }}
            description="输入框调试工具"
          >⌨️ 输入调试</List.Item>
        </List>
      )
    }
  ]

  const filtered = keyword
    ? sections.filter(s => s.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase())))
    : sections

  // 搜索时自动展开匹配项
  useEffect(() => {
    if (keyword) {
      setActiveKeys(filtered.map(s => s.key))
    }
  }, [keyword])

  return (
    <div className="page">
      <div style={{
        flexShrink: 0,
        paddingTop: 'max(10px, env(safe-area-inset-top))',
        padding: '10px 12px 8px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>设置</span>
          <Button size="mini" fill="none" onClick={() => { logout(); nav('/login') }}>退出</Button>
        </div>

        {/* 用户卡片 - 紧凑版 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 8
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent-blue) 0%, #6E9BFF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: 'white', fontWeight: 700, flexShrink: 0
          }}>{(user?.username || 'U')[0].toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.display_name || user?.username}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {user?.role || 'operator'} · 登录中
            </div>
          </div>
        </div>

        {/* 搜索框 */}
        <div style={{ marginTop: 8 }}>
          <SearchBar
            placeholder="搜索设置项"
            value={keyword}
            onChange={setKeyword}
            style={{ '--height': '32px', '--border-radius': '8px', '--background': 'var(--bg-secondary)' } as any}
          />
        </div>
      </div>

      {/* 折叠卡片区 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px 12px 16px' }}>
        <Collapse
          activeKey={activeKeys}
          onChange={keys => setActiveKeys(keys as string[])}
          accordion={false}
        >
          {filtered.map(s => (
            <Collapse.Panel key={s.key} title={s.title} style={{ marginBottom: 6 }}>
              {s.render()}
            </Collapse.Panel>
          ))}
        </Collapse>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
            未找到匹配项
          </div>
        )}
      </div>

      <VersionSelector
        visible={showVersionSelector}
        currentVersion={getCurrentVersion()}
        onClose={() => setShowVersionSelector(false)}
      />
    </div>
  )
}
