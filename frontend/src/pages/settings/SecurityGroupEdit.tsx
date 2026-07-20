import { useEffect, useState } from 'react'
import { Form, Selector, Button, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import NativeInput from '@/components/NativeInput'
import { api, friendlyApiError } from '@/api/client'
import { loadTemplates, updateTemplate } from '@/utils/sgStorage'

const TENCENT_REGIONS = [
  'ap-beijing', 'ap-shanghai', 'ap-guangzhou', 'ap-chengdu',
  'ap-nanjing', 'ap-hongkong', 'ap-shenzhen-fsi'
]

export default function SecurityGroupEditPage() {
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [form] = Form.useForm()
  const [clouds, setClouds] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    api.listCloudAccounts().then(setClouds).catch(() => setClouds([]))
    const templates = loadTemplates()
    const tpl = templates.find(t => t.id === id)
    if (!tpl) {
      setNotFound(true)
      return
    }
    form.setFieldsValue({
      name: tpl.name,
      sg_id: tpl.sg_id,
      region: [tpl.region],
      port: (tpl as any).port || '18443',
      protocol: [(tpl as any).protocol || 'TCP'],
      description: tpl.description || '',
      secret_id: tpl.secret_id,
      secret_key: tpl.secret_key
    })
  }, [id])

  const submit = async () => {
    if (!id) return
    try {
      const v = await form.validateFields()
      setLoading(true)

      // 如果选择了新的云账号，使用新的 AK/SK
      let secret_id = v.secret_id
      let secret_key = v.secret_key
      const selectedCloudId = Array.isArray(v.cloud_account_id) ? v.cloud_account_id[0] : v.cloud_account_id
      if (selectedCloudId) {
        const ca = clouds.find(c => c.id === selectedCloudId)
        if (ca) {
          secret_id = ca.secret_id
          secret_key = ca.secret_key
        }
      }

      const success = updateTemplate(id, {
        name: v.name,
        sg_id: v.sg_id,
        region: Array.isArray(v.region) ? v.region[0] : v.region,
        secret_id,
        secret_key,
        description: v.description,
        ...({
          port: v.port,
          protocol: Array.isArray(v.protocol) ? v.protocol[0] : v.protocol
        } as any)
      })

      if (success) {
        Toast.show({ content: '已保存', icon: 'success' })
        nav(-1)
      } else {
        Toast.show({ content: '保存失败', icon: 'fail' })
      }
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  if (notFound) {
    return (
      <PageShell title="编辑白名单" onBack={() => nav(-1)}>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          模板不存在
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="编辑白名单" onBack={() => nav(-1)}>
      <div style={{
        margin: '0 12px 12px', padding: 10, borderRadius: 8,
        background: 'rgba(255, 200, 0, 0.1)', color: 'var(--warning)', fontSize: 11
      }}>
        💡 模板仅存储在本地，后端接口暂不可用，请等待功能更新。
      </div>

      <Form
        form={form}
        layout="vertical"
        mode="card"
        footer={
          <Button block color="primary" size="large" loading={loading} onClick={submit}>
            保存
          </Button>
        }
      >
        <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="模板名称" />
        </Form.Item>

        <Form.Item name="cloud_account_id" label="切换云账号（可选）">
          <Selector
            columns={1}
            options={clouds.map(c => ({ label: `${c.name} (${c.region})`, value: c.id }))}
          />
        </Form.Item>

        <Form.Item name="region" label="安全组所在地域" rules={[{ required: true, message: '必选' }]}>
          <Selector
            columns={3}
            options={TENCENT_REGIONS.map(r => ({ label: r, value: r }))}
          />
        </Form.Item>

        <Form.Item name="sg_id" label="安全组 ID" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="sg-xxxxxxxx" />
        </Form.Item>

        <Form.Item name="port" label="端口" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="18443 / 80,443 / ALL" />
        </Form.Item>

        <Form.Item name="protocol" label="协议">
          <Selector
            columns={3}
            options={[
              { label: 'TCP', value: 'TCP' },
              { label: 'UDP', value: 'UDP' },
              { label: 'ALL', value: 'ALL' }
            ]}
          />
        </Form.Item>

        <Form.Item name="description" label="规则备注" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="规则备注" />
        </Form.Item>
      </Form>
    </PageShell>
  )
}
