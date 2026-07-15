import { useEffect, useState } from 'react'
import { List, Button } from 'antd-mobile'
import { AddOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'

export default function CloudSettingsPage() {
  const nav = useNavigate()
  const [list, setList] = useState<any[]>([])
  useEffect(() => { api.listCloudAccounts().then(l => setList(l || [])).catch(() => setList([])) }, [])

  return (
    <PageShell title="云账号" onBack={() => nav(-1)}>
      <div style={{
        margin: '0 12px 16px', padding: 12, borderRadius: 8,
        background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12
      }}>
        ⚠️ AK/SK 会 AES-256 加密后存到 PostgreSQL。建议使用**只有 TKE 只读+扩缩容权限**的子账号 AK/SK。
      </div>

      <List mode="card">
        {list.map(a => (
          <List.Item key={a.id} description={`${a.provider} · ${a.region}`}>
            {a.name}
          </List.Item>
        ))}
        {list.length === 0 && (
          <List.Item>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>还没有云账号</div>
          </List.Item>
        )}
      </List>

      <Button
        block color="primary" size="large"
        onClick={() => nav('/settings/cloud/new')}
        style={{ marginTop: 24 }}
      ><AddOutline /> 添加腾讯云账号</Button>
    </PageShell>
  )
}
