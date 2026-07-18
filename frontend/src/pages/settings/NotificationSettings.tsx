import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, Button, Dialog, Toast, Switch, Input, Selector, SwipeAction } from 'antd-mobile'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'

interface Webhook {
  id: number
  name: string
  type: string
  webhook_url: string
  secret: string
  enabled: boolean
  min_severity: string
}

export default function NotificationSettings() {
  const nav = useNavigate()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  // 新增表单
  const [name, setName] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [minSeverity, setMinSeverity] = useState('warning')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/notifications/webhooks')
      setWebhooks(r || [])
    } catch (e: any) {
      Toast.show({ content: '加载失败: ' + (e?.response?.data?.error || e?.message), icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const addWebhook = async () => {
    if (!name || !webhookUrl) {
      Toast.show({ content: '请填写名称和 Webhook URL', icon: 'fail' })
      return
    }
    try {
      await api.post('/notifications/webhooks', {
        name,
        type: 'feishu',
        webhook_url: webhookUrl,
        secret,
        enabled: true,
        min_severity: minSeverity
      })
      Toast.show({ content: '添加成功', icon: 'success' })
      setShowAdd(false)
      setName(''); setWebhookUrl(''); setSecret(''); setMinSeverity('warning')
      load()
    } catch (e: any) {
      Toast.show({ content: '添加失败: ' + (e?.response?.data?.error || e?.message), icon: 'fail' })
    }
  }

  const testWebhook = async (id: number) => {
    Toast.show({ content: '发送测试消息...', icon: 'loading', duration: 1500 })
    try {
      await api.post(`/notifications/webhooks/${id}/test`)
      Toast.show({ content: '测试消息已发送，请查看飞书群', icon: 'success', duration: 2000 })
    } catch (e: any) {
      Toast.show({ content: '测试失败: ' + (e?.response?.data?.error || e?.message), icon: 'fail', duration: 3000 })
    }
  }

  const toggleEnabled = async (w: Webhook) => {
    try {
      await api.put(`/notifications/webhooks/${w.id}`, { enabled: !w.enabled })
      load()
    } catch (e: any) {
      Toast.show({ content: '操作失败', icon: 'fail' })
    }
  }

  const deleteWebhook = async (id: number) => {
    const ok = await Dialog.confirm({ content: '确认删除该通知渠道？' })
    if (!ok) return
    try {
      await api.delete(`/notifications/webhooks/${id}`)
      Toast.show({ content: '已删除', icon: 'success' })
      load()
    } catch (e: any) {
      Toast.show({ content: '删除失败', icon: 'fail' })
    }
  }

  return (
    <PageShell title="通知渠道" onBack={() => nav(-1)}>
      <div style={{ padding: 12 }}>
        {/* 说明 */}
        <div style={{
          background: 'var(--bg-elevated)',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            📢 飞书群 Webhook 告警推送
          </div>
          <div>1. 在飞书群点右上角 → 设置 → 群机器人 → 添加</div>
          <div>2. 选择「自定义机器人」，复制 Webhook 地址</div>
          <div>3. 粘贴到下方并保存</div>
          <div style={{ marginTop: 4, opacity: 0.8 }}>
            告警触发时会自动推送卡片消息到群
          </div>
        </div>

        {/* Webhook 列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>加载中...</div>
        ) : webhooks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            <div>还没有配置通知渠道</div>
          </div>
        ) : (
          <List mode="card">
            {webhooks.map(w => (
              <SwipeAction
                key={w.id}
                rightActions={[
                  { key: 'test', text: '测试', color: 'primary', onClick: () => testWebhook(w.id) },
                  { key: 'delete', text: '删除', color: 'danger', onClick: () => deleteWebhook(w.id) }
                ]}
              >
                <List.Item
                  extra={
                    <Switch
                      checked={w.enabled}
                      onChange={() => toggleEnabled(w)}
                      style={{ '--height': '24px', '--width': '44px' } as any}
                    />
                  }
                  description={
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      <div>{w.type === 'feishu' ? '📘 飞书' : w.type} · 级别: {w.min_severity}</div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.webhook_url}
                      </div>
                    </div>
                  }
                >
                  {w.name}
                </List.Item>
              </SwipeAction>
            ))}
          </List>
        )}

        {/* 新增按钮 */}
        {!showAdd && (
          <Button
            block
            color="primary"
            style={{ marginTop: 16 }}
            onClick={() => setShowAdd(true)}
          >
            + 添加飞书 Webhook
          </Button>
        )}

        {/* 新增表单 */}
        {showAdd && (
          <div style={{
            background: 'var(--bg-elevated)',
            padding: 16,
            borderRadius: 8,
            marginTop: 16
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>添加飞书 Webhook</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text-secondary)' }}>名称</div>
              <Input placeholder="例如：运维告警群" value={name} onChange={setName} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text-secondary)' }}>Webhook URL *</div>
              <Input
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                value={webhookUrl}
                onChange={setWebhookUrl}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text-secondary)' }}>签名密钥（可选）</div>
              <Input placeholder="Secret（如果启用了签名校验）" value={secret} onChange={setSecret} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text-secondary)' }}>最低告警级别</div>
              <Selector
                columns={3}
                value={[minSeverity]}
                onChange={v => v[0] && setMinSeverity(v[0])}
                options={[
                  { label: 'INFO', value: 'info' },
                  { label: 'WARNING', value: 'warning' },
                  { label: 'CRITICAL', value: 'critical' }
                ]}
              />
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                只推送不低于该级别的告警
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button block onClick={() => { setShowAdd(false); setName(''); setWebhookUrl(''); setSecret('') }}>取消</Button>
              <Button block color="primary" onClick={addWebhook}>保存</Button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
