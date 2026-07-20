import { useEffect, useState } from 'react'
import { NavBar, Card, Button, Toast, Dialog, Form, Input, Switch } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api, friendlyApiError } from '@/api/client'

export default function VMSettingsPage() {
  const nav = useNavigate()
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const r = await api.listVMSources()
      setSources(r)
    } catch (e) {
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onDelete = async (id: number, name: string) => {
    const confirm = await Dialog.confirm({ content: `确认删除 ${name}？` })
    if (!confirm) return
    try {
      await api.deleteVMSource(id)
      Toast.show({ icon: 'success', content: '已删除' })
      load()
    } catch (e) {
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
    }
  }

  const onAdd = async () => {
    const result = await Dialog.confirm({
      title: '新增 VictoriaMetrics 数据源',
      content: (
        <Form layout="horizontal">
          <Form.Item label="名称"><Input placeholder="生产环境 VM" id="vm-name" /></Form.Item>
          <Form.Item label="URL"><Input placeholder="http://172.22.67.24:8481" id="vm-url" /></Form.Item>
          <Form.Item label="描述"><Input placeholder="可选" id="vm-desc" /></Form.Item>
        </Form>
      ),
      confirmText: '添加'
    })
    if (!result) return
    const name = (document.getElementById('vm-name') as HTMLInputElement)?.value
    const url = (document.getElementById('vm-url') as HTMLInputElement)?.value
    const description = (document.getElementById('vm-desc') as HTMLInputElement)?.value
    if (!name || !url) {
      Toast.show({ icon: 'fail', content: '名称和 URL 必填' })
      return
    }
    try {
      await api.createVMSource({ name, url, description, is_default: false })
      Toast.show({ icon: 'success', content: '已添加' })
      load()
    } catch (e) {
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
    }
  }

  if (loading) {
    return (
      <div className="page">
        <NavBar onBack={() => nav(-1)}>VictoriaMetrics 配置</NavBar>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中...</div>
      </div>
    )
  }

  return (
    <div className="page">
      <NavBar onBack={() => nav(-1)}>VictoriaMetrics 配置</NavBar>
      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
        {sources.map(s => (
          <Card key={s.id} title={s.name} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, wordBreak: 'break-all' }}>
              {s.url}
            </div>
            {s.description && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                {s.description}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {s.is_default && <span style={{ fontSize: 11, color: 'var(--success)' }}>✓ 默认</span>}
              <Button size="small" color="danger" fill="outline" onClick={() => onDelete(s.id, s.name)}>
                删除
              </Button>
            </div>
          </Card>
        ))}
        {sources.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            暂无数据源
          </div>
        )}
        <Button block color="primary" onClick={onAdd} style={{ marginTop: 16 }}>
          新增数据源
        </Button>
      </div>
    </div>
  )
}

