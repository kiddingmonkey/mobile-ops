import { useEffect, useState } from 'react'
import { List, Button } from 'antd-mobile'
import { AddOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'

export default function PromSettingsPage() {
  const nav = useNavigate()
  const [list, setList] = useState<any[]>([])
  useEffect(() => { api.listProm().then(l => setList(l || [])).catch(() => setList([])) }, [])

  return (
    <PageShell title="Prometheus" onBack={() => nav(-1)}>
      <List mode="card">
        {list.map(p => (
          <List.Item
            key={p.id}
            description={`${p.url} · ${p.auth_type}`}
            extra={p.is_default && <span className="status-badge info">默认</span>}
          >{p.name}</List.Item>
        ))}
        {list.length === 0 && (
          <List.Item>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>还没有 Prometheus 数据源</div>
          </List.Item>
        )}
      </List>

      <Button
        block color="primary" size="large"
        onClick={() => nav('/settings/prom/new')}
        style={{ marginTop: 24 }}
      ><AddOutline /> 添加 Prometheus</Button>
    </PageShell>
  )
}
