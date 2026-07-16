import { useEffect, useRef, useState } from 'react'
import { Form, Selector, Switch, TextArea, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import NativeInput from '@/components/NativeInput'
import { api, friendlyApiError } from '@/api/client'

export default function ClusterNewPage() {
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [autoPull, setAutoPull] = useState(false) // 默认改成手动粘贴（更常用）
  const [loading, setLoading] = useState(false)
  const [clouds, setClouds] = useState<any[]>([])
  const [grafanas, setGrafanas] = useState<any[]>([])
  const [proms, setProms] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.listCloudAccounts().then(setClouds).catch(() => setClouds([]))
    api.listGrafana().then(setGrafanas).catch(() => setGrafanas([]))
    api.listProm().then(setProms).catch(() => setProms([]))
  }, [])

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      Toast.show({ content: 'kubeconfig 太大（>512KB），检查是否选错文件', icon: 'fail' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result || '')
      form.setFieldsValue({ kubeconfig: content })
      Toast.show({ content: `已导入 ${file.name}`, icon: 'success' })
    }
    reader.onerror = () => Toast.show({ content: '读取文件失败', icon: 'fail' })
    reader.readAsText(file)
    // 清空 input，允许下次选同名文件
    e.target.value = ''
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      const payload: any = {
        name: v.name,
        display_name: v.display_name,
        provider: 'tencent',
        provider_cluster_id: v.provider_cluster_id,
        region: v.region,
        cloud_account_id: pickOne(v.cloud_account_id),
        grafana_source_id: pickOne(v.grafana_source_id),
        grafana_cluster_var: v.grafana_cluster_var,
        prom_source_id: pickOne(v.prom_source_id),
        auto_pull_kubeconfig: autoPull,
        is_extranet: !!v.is_extranet
      }
      if (!autoPull) payload.kubeconfig = v.kubeconfig
      setLoading(true)
      await api.createCluster(payload)
      Toast.show({ content: '添加成功', icon: 'success' })
      nav(-1)
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail', duration: 4000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell title="添加 K8s 集群" onBack={() => nav(-1)}>
      <Form
        form={form}
        layout="vertical"
        mode="card"
        initialValues={{ region: 'ap-beijing' }}
        footer={
          <Button block color="primary" size="large" loading={loading} onClick={submit}>
            保存
          </Button>
        }
      >
        <Form.Header>基础信息</Form.Header>
        <Form.Item name="name" label="集群名 (唯一)" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="prod-tke-01" />
        </Form.Item>
        <Form.Item name="display_name" label="显示名">
          <NativeInput placeholder="生产集群 01" />
        </Form.Item>
        <Form.Item name="region" label="地域">
          <NativeInput placeholder="ap-beijing" />
        </Form.Item>

        <Form.Header>Kubeconfig 来源</Form.Header>
        <Form.Item label="自动拉取（需要云账号写权限）" childElementPosition="right">
          <Switch checked={autoPull} onChange={setAutoPull} />
        </Form.Item>

        {autoPull ? (
          <>
            <Form.Item name="cloud_account_id" label="云账号" rules={[{ required: true, message: '必选' }]}>
              <Selector
                columns={1}
                options={clouds.map(c => ({ label: `${c.name} (${c.region})`, value: c.id }))}
              />
            </Form.Item>
            <Form.Item name="provider_cluster_id" label="TKE ClusterId" rules={[{ required: true, message: '必填' }]}>
              <NativeInput placeholder="cls-xxxxxx" usePlaceholderAsDefault={false} />
            </Form.Item>
            <Form.Item name="is_extranet" label="使用外网 kubeconfig" childElementPosition="right">
              <Switch />
            </Form.Item>
          </>
        ) : (
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
                block
                fill="outline"
                color="primary"
                onClick={() => fileInputRef.current?.click()}
              >📁 从文件上传 kubeconfig</Button>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center' }}>
                支持 .yaml / .yml / .conf / .kubeconfig（&lt;512KB）
              </div>
            </Form.Item>
            <Form.Item name="kubeconfig" label="或粘贴 Kubeconfig YAML" rules={[{ required: true, message: '必填（上传文件后会自动填充）' }]}>
              <TextArea
                rows={8}
                autoSize={{ minRows: 6, maxRows: 15 }}
                placeholder="apiVersion: v1&#10;kind: Config&#10;..."
              />
            </Form.Item>
            <Form.Item name="provider_cluster_id" label="TKE ClusterId (可选，用于云 API 操作)">
              <NativeInput placeholder="cls-xxxxxx" usePlaceholderAsDefault={false} />
            </Form.Item>
            <Form.Item name="cloud_account_id" label="云账号 (可选，扩缩容时用)">
              <Selector
                columns={1}
                options={clouds.map(c => ({ label: `${c.name} (${c.region})`, value: c.id }))}
              />
            </Form.Item>
          </>
        )}

        <Form.Header>关联数据源</Form.Header>
        <Form.Item name="grafana_source_id" label="Grafana">
          <Selector
            columns={1}
            options={grafanas.map(g => ({ label: g.name, value: g.id }))}
          />
        </Form.Item>
        <Form.Item
          name="grafana_cluster_var"
          label="Grafana / Prom cluster 标签值"
          help="Prometheus 里 kube_node_info{cluster=?} 的值，用于交叉验证节点数"
        >
          <NativeInput placeholder="prod / cls-9p2b79wz / 自定义" usePlaceholderAsDefault={false} />
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
