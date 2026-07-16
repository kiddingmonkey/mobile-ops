import { useEffect, useState } from 'react'
import { PullToRefresh, Tabs, Collapse, Button, Dialog, Toast, Switch } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { fmtRelative, fmtTime } from '@/utils/format'
import StatCard from '@/components/StatCard'
import { sendUrgentAlert, getTTSEnabled, setTTSEnabled, getFloatingAlertEnabled, setFloatingAlertEnabled, requestFloatingPermission, testTTS } from '@/utils/alertNotifier'
import { Capacitor } from '@capacitor/core'

export default function AlertsPage() {
  const nav = useNavigate()
  const [alerts, setAlerts] = useState<any[]>([])
  const [tab, setTab] = useState('all')
  const [ttsOn, setTtsOn] = useState(getTTSEnabled())
  const [floatingOn, setFloatingOn] = useState(getFloatingAlertEnabled())

  const load = async () => {
    const a = await api.listAlerts(200).catch(() => [])
    setAlerts(a || [])
  }
  useEffect(() => { load() }, [])

  // 测试告警通知
  const testAlert = async (severity: 'critical' | 'warning') => {
    const testData = {
      id: Date.now(),
      title: severity === 'critical' ? '测试紧急告警' : '测试警告告警',
      message: severity === 'critical'
        ? '这是一条测试紧急告警，包含震动、声音、语音播报和悬浮窗'
        : '这是一条测试警告告警，包含震动和通知',
      severity,
      source: '测试来源'
    }

    try {
      await sendUrgentAlert(testData)
      Toast.show({ content: '测试告警已发送', icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e.message || '发送失败', icon: 'fail' })
    }
  }

  // 显示测试菜单
  const showTestMenu = () => {
    Dialog.show({
      title: '测试告警通知',
      content: (
        <div style={{ padding: '12px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>通知功能开关</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>语音播报（仅紧急告警）</span>
              <Switch
                checked={ttsOn}
                onChange={(checked) => {
                  setTtsOn(checked)
                  setTTSEnabled(checked)
                  Toast.show({ content: checked ? '已开启语音播报' : '已关闭语音播报' })
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>悬浮窗通知（仅紧急告警）</span>
              <Switch
                checked={floatingOn}
                onChange={async (checked) => {
                  if (checked && Capacitor.isNativePlatform()) {
                    const granted = await requestFloatingPermission()
                    if (!granted) {
                      Toast.show({ content: '请在系统设置中授予悬浮窗权限', duration: 3000 })
                      return
                    }
                  }
                  setFloatingOn(checked)
                  setFloatingAlertEnabled(checked)
                  Toast.show({ content: checked ? '已开启悬浮窗' : '已关闭悬浮窗' })
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>选择测试类型</div>
            <Button
              block
              color="danger"
              onClick={() => {
                Dialog.clear()
                testAlert('critical')
              }}
              style={{ marginBottom: 8 }}
            >
              测试紧急告警（震动+声音+播报+悬浮窗）
            </Button>
            <Button
              block
              color="warning"
              onClick={() => {
                Dialog.clear()
                testAlert('warning')
              }}
              style={{ marginBottom: 8 }}
            >
              测试警告告警（震动+通知）
            </Button>
            <Button
              block
              fill="outline"
              onClick={async () => {
                const success = await testTTS('这是语音播报测试')
                Toast.show({ content: success ? '播放成功' : '播放失败', icon: success ? 'success' : 'fail' })
              }}
            >
              测试语音播报
            </Button>
          </div>
        </div>
      ),
      closeOnMaskClick: true,
      actions: [{ key: 'close', text: '关闭' }]
    })
  }

  const firing = alerts.filter(a => a.status === 'firing')
  const critical = firing.filter(a => a.severity === 'critical')
  const warning = firing.filter(a => a.severity === 'warning')

  const filtered = tab === 'all' ? alerts
    : tab === 'critical' ? alerts.filter(a => a.severity === 'critical')
    : tab === 'warning' ? alerts.filter(a => a.severity === 'warning')
    : alerts.filter(a => a.status === 'resolved')

  const severityColor = (s: string) =>
    s === 'critical' ? 'var(--danger)' : s === 'warning' ? 'var(--warning)' : 'var(--accent-blue)'

  return (
    <div className="page">
      <div className="page-header" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <span className="title">告警中心</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            size="mini"
            color="primary"
            fill="outline"
            onClick={showTestMenu}
          >
            测试
          </Button>
          <span className="text-xs">{firing.length} 活跃</span>
        </div>
      </div>
      <PullToRefresh onRefresh={load}>
        <div className="page-content">
          <StatCard items={[
            { label: '严重', value: critical.length, color: 'var(--danger)' },
            { label: '警告', value: warning.length, color: 'var(--warning)' },
            { label: '已恢复', value: alerts.filter(a => a.status === 'resolved').length, color: 'var(--success)' },
            { label: '总计', value: alerts.length }
          ]} />

          <Tabs activeKey={tab} onChange={setTab} style={{
            '--title-font-size': '13px',
            '--active-title-color': 'var(--accent-blue)',
            '--active-line-color': 'var(--accent-blue)'
          } as any}>
            <Tabs.Tab title={`全部 (${alerts.length})`} key="all" />
            <Tabs.Tab title={`严重 (${critical.length})`} key="critical" />
            <Tabs.Tab title={`警告 (${warning.length})`} key="warning" />
            <Tabs.Tab title="已恢复" key="resolved" />
          </Tabs>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <div className="empty-title">暂无{tab === 'all' ? '' : '此类'}告警</div>
              <div className="empty-text">
                配置 alertmanager webhook 到<br/>
                <code style={{ color: 'var(--accent-blue)', fontSize: 11 }}>/api/v1/alerts/webhook</code>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(a => (
                <div key={a.id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* 左侧状态点 */}
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: a.status === 'firing' ? severityColor(a.severity) : 'var(--success)',
                      marginTop: 5, flexShrink: 0,
                      boxShadow: a.status === 'firing' ? `0 0 6px ${severityColor(a.severity)}` : 'none'
                    }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 标题行 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{a.alertname}</span>
                        <span className={`status-badge ${a.status === 'firing' ? 'danger' : 'success'}`} style={{ fontSize: 10 }}>
                          {a.status}
                        </span>
                      </div>
                      {/* 摘要 */}
                      {a.summary && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                          {a.summary}
                        </div>
                      )}
                      {/* 时间 + severity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span className={`status-badge ${a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'}`}>
                          {a.severity}
                        </span>
                        <span className="text-xs">{fmtRelative(a.starts_at)}</span>
                      </div>
                      {/* 展开详情 */}
                      {(a.labels || a.annotations) && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}>
                            查看详情
                          </summary>
                          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                            {a.labels && Object.entries(a.labels).map(([k, v]) => (
                              <div key={k}><b>{k}:</b> {String(v)}</div>
                            ))}
                            {a.annotations && Object.entries(a.annotations).map(([k, v]) => (
                              <div key={k}><b>{k}:</b> {String(v)}</div>
                            ))}
                            <div style={{ marginTop: 4 }}>开始: {fmtTime(a.starts_at)}</div>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>
    </div>
  )
}
