import { useEffect, useState } from 'react'
import { List, Button, Dialog, SwipeAction, Toast } from 'antd-mobile'
import { AddOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'

export default function GrafanaSettingsPage() {
  const nav = useNavigate()
  const [list, setList] = useState<any[]>([])

  const load = async () => setList(await api.listGrafana().catch(() => []))
  useEffect(() => { load() }, [])

  const del = async (id: number) => {
    const ok = await Dialog.confirm({ content: '删除这个 Grafana 数据源？' })
    if (!ok) return
    await api.deleteGrafana(id)
    Toast.show({ content: '已删除' })
    load()
  }

  return (
    <PageShell title="Grafana" onBack={() => nav(-1)}>
      <List mode="card">
        {list.map(g => (
          <SwipeAction
            key={g.id}
            rightActions={[{
              key: 'del', text: '删除', color: 'danger',
              onClick: () => del(g.id)
            }]}
          >
            <List.Item
              description={g.url}
              extra={g.is_default && <span className="status-badge info">默认</span>}
            >{g.name}</List.Item>
          </SwipeAction>
        ))}
        {list.length === 0 && (
          <List.Item>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>还没有 Grafana 数据源</div>
          </List.Item>
        )}
      </List>

      <Button
        block color="primary" size="large"
        onClick={() => nav('/settings/grafana/new')}
        style={{ marginTop: 24 }}
      ><AddOutline /> 添加 Grafana</Button>
    </PageShell>
  )
}
