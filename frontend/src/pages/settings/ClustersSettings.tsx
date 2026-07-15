import { useEffect, useState } from 'react'
import { List, Button, SwipeAction, Toast, Dialog } from 'antd-mobile'
import { AddOutline, RightOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'

export default function ClustersSettingsPage() {
  const nav = useNavigate()
  const [list, setList] = useState<any[]>([])

  const load = async () => setList(await api.listClusters().catch(() => []))
  useEffect(() => { load() }, [])

  const sync = async (id: number) => {
    Toast.show({ icon: 'loading', content: '同步节点池…', duration: 0 })
    try {
      await api.syncCluster(id)
      Toast.show({ content: '同步完成', icon: 'success' })
      load()
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '同步失败', icon: 'fail' })
    }
  }

  const del = async (c: any) => {
    const ok = await Dialog.confirm({ content: `确认删除集群「${c.display_name || c.name}」？` })
    if (!ok) return
    try {
      await api.deleteCluster(c.id)
      Toast.show({ content: '已删除', icon: 'success' })
      load()
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '删除失败', icon: 'fail' })
    }
  }

  return (
    <PageShell title="K8s 集群" onBack={() => nav(-1)}>
      <List mode="card">
        {list.map(c => (
          <SwipeAction
            key={c.id}
            rightActions={[
              { key: 'sync', text: '同步', color: 'primary', onClick: () => sync(c.id) },
              { key: 'del', text: '删除', color: 'danger', onClick: () => del(c) }
            ]}
          >
            <List.Item
              description={`${c.provider} · ${c.region || '-'}${c.provider_cluster_id ? ' · ' + c.provider_cluster_id : ''}`}
              extra={<RightOutline />}
              onClick={() => nav(`/settings/clusters/${c.id}/edit`)}
            >{c.display_name || c.name}</List.Item>
          </SwipeAction>
        ))}
        {list.length === 0 && (
          <List.Item>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
              还没有集群，点下方按钮添加
            </div>
          </List.Item>
        )}
      </List>

      <div style={{
        margin: '12px 12px 0', padding: 10, borderRadius: 8,
        background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: 12
      }}>
        点击项进入编辑，左滑显示同步/删除
      </div>

      <Button
        block color="primary" size="large"
        onClick={() => nav('/settings/clusters/new')}
        style={{ marginTop: 24 }}
      ><AddOutline /> 添加集群</Button>
    </PageShell>
  )
}
