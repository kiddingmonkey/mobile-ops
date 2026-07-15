import { useEffect, useRef, useState } from 'react'
import { Form, Input, Selector, TextArea, Button, Toast, Dialog, Skeleton } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'

export default function ClusterEditPage() {
  const nav = useNavigate()
  const { id: idStr } = useParams()
  const id = Number(idStr)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cluster, setCluster] = useState<any>(null)
  const [clouds, setClouds] = useState<any[]>([])
  const [grafanas, setGrafanas] = useState<any[]>([])
  const [proms, setProms] = useState<any[]>([])
  const [replaceKubeconfig, setReplaceKubeconfig] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      try {
        const [c, cs, gs, ps] = await Promise.all([
          api.getCluster(id),
          api.listCloudAccounts().catch(() => []),
          api.listGrafana().catch(() => []),
          api.listProm().catch(() => [])
        ])
        setCluster(c)
        setClouds(cs)
        setGrafanas(gs)
        setProms(ps)
        form.setFieldsValue({
          display_name: c.display_name || '',
          region: c.region || '',
          provider_cluster_id: c.provider_cluster_id || '',
          cloud_account_id: c.cloud_account_id ? [c.cloud_account_id] : [],
          grafana_source_id: c.grafana_source_id ? [c.grafana_source_id] : [],
          grafana_cluster_var: c.grafana_cluster_var || '',
          prom_source_id: c.prom_source_id ? [c.prom_source_id] : []
        })
      } catch (e: any) {
        Toast.show({ content: e?.response?.data?.error || '加载失败', icon: 'fail' })
        nav(-1)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      Toast.show({ content: 'kubeconfig 太大', icon: 'fail' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      form.setFieldsValue({ kubeconfig: String(reader.result || '') })
      Toast.show({ content: `已导入 ${file.name}`, icon: 'success' })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      const payload: Record<string, any> = {
        display_name: v.display_name,
        region: v.region,
        provider_cluster_id: v.provider_cluster_id,
        cloud_account_id: pickOne(v.cloud_account_id),
        grafana_source_id: pickOne(v.grafana_source_id),
        grafana_cluster_var: v.grafana_cluster_var,
        prom_source_id: pickOne(v.prom_source_id)
      }
      if (replaceKubeconfig && v.kubeconfig) {
        payload.kubeconfig = v.kubeconfig
      }
      // 剔除 undefined
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
      setSaving(true)
      await api.updateCluster(id, payload)
      Toast.show({ content: '保存成功', icon: 'success' })
      nav(-1)
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || e?.message || '失败', icon: 'fail', duration: 4000 })
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    const ok = await Dialog.confirm({
      content: (
        <div>
          <p>确认删除集群 <b>{cluster?.name}</b>？</p>
          <p style={{ color: 'var(--danger)', fontSize: 13 }}>
            会同时删除关联的节点池和操作记录，不可恢复。
          </p>
        </div>
      )
    })
    if (!ok) return
    try {
      setDeleting(true)
      await api.deleteCluster(id)
      Toast.show({ content: '已删除', icon: 'success' })
      nav('/settings/clusters', { replace: true })
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '删除失败', icon: 'fail' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <PageShell title="编辑集群" onBack={() => nav(-1)}>
        <Skeleton animated style={{ '--height': '200px' } as any} />
      </PageShell>
    )
  }

  return (
    <PageShell title="编辑集群" onBack={() => nav(-1)}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>集群名（不可改）</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{cluster.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          Kubeconfig: {cluster.has_kubeconfig ? '✅ 已配置' : '❌ 未配置'} · 状态: {cluster.status}
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        mode="card"
        footer={
          <>
            <Button block color="primary" size="large" loading={saving} onClick={submit}>
              保存修改
            </Button>
            <Button
              block color="danger" fill="outline" size="large"
              loading={deleting} onClick={del}
              style={{ marginTop: 12 }}
            >删除集群</Button>
          </>
        }
      >
        <Form.Header>基础信息</Form.Header>
        <Form.Item name="display_name" label="显示名">
          <Input placeholder="生产集群 01" />
        </Form.Item>
        <Form.Item name="region" label="地域">
          <Input placeholder="ap-beijing" />
        </Form.Item>
        <Form.Item name="provider_cluster_id" label="TKE ClusterId">
          <Input placeholder="cls-xxxxxx" />
        </Form.Item>
        <Form.Item name="cloud_account_id" label="云账号">
          <Selector
            columns={1}
            options={clouds.map(c => ({ label: `${c.name} (${c.region})`, value: c.id }))}
          />
        </Form.Item>

        <Form.Header>Kubeconfig</Form.Header>
        <Form.Item label="替换 kubeconfig" childElementPosition="right">
          <Button
            size="small"
            fill={replaceKubeconfig ? 'solid' : 'outline'}
            color={replaceKubeconfig ? 'primary' : 'default'}
            onClick={() => setReplaceKubeconfig(v => !v)}
          >{replaceKubeconfig ? '取消替换' : '替换'}</Button>
        </Form.Item>
        {replaceKubeconfig && (
          <>
            <Form.Item>
              <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml,.conf,.kubeconfig,text/plain,application/x-yaml"
                onChange={onPickFile}
                style={{ display: 'none' }}
              />
              <Button
                block fill="outline" color="primary"
                onClick={() => fileInputRef.current?.click()}
              >📁 从文件上传新 kubeconfig</Button>
            </Form.Item>
            <Form.Item name="kubeconfig" label="新 Kubeconfig YAML">
              <TextArea rows={8} autoSize={{ minRows: 6, maxRows: 15 }} placeholder="apiVersion: v1&#10;..." />
            </Form.Item>
          </>
        )}

        <Form.Header>数据源关联</Form.Header>
        <Form.Item name="grafana_source_id" label="Grafana">
          <Selector
            columns={1}
            options={grafanas.map(g => ({ label: g.name, value: g.id }))}
          />
        </Form.Item>
        <Form.Item
          name="grafana_cluster_var"
          label="cluster 变量值 (关键)"
          help="Prometheus 里 kube_node_info 的 cluster 标签值，缺失会导致节点数错乱"
        >
          <Input placeholder="cls-xxxxxx" />
        </Form.Item>
        <Form.Item name="prom_source_id" label="Prometheus">
          <Selector
            columns={1}
            options={proms.map(p => ({ label: p.name, value: p.id }))}
          />
        </Form.Item>
      </Form>
    </PageShell>
  )
}

function pickOne(v: any) {
  if (Array.isArray(v)) return v[0]
  return v
}
