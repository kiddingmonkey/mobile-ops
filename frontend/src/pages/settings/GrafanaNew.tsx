import { useState } from 'react'
import { Form, Switch, Button, Toast, Space } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import NativeInput from '@/components/NativeInput'
import { api, friendlyApiError } from '@/api/client'

// 表单字段 -> 示例值 (placeholder 同源)
const DEFAULTS = {
  name: '内网 Grafana',
  url: 'http://172.22.211.72:3000',
  token: 'eyJrIjoi...'
}

export default function GrafanaNewPage() {
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const fillDefaults = () => {
    form.setFieldsValue(DEFAULTS)
    Toast.show({ content: '已填充示例值', icon: 'success', duration: 1000 })
  }

  const submit = async () => {
    // 提交前把空字段用示例值兜底 —— 用户可能没经过 blur 就点保存
    const cur = form.getFieldsValue()
    const patch: Record<string, any> = {}
    for (const k of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
      if (!cur[k]) patch[k] = DEFAULTS[k]
    }
    if (Object.keys(patch).length) form.setFieldsValue(patch)

    try {
      const v = await form.validateFields()
      setLoading(true)
      await api.createGrafana(v)
      Toast.show({ content: '添加成功', icon: 'success' })
      nav(-1)
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail', duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell title="添加 Grafana" onBack={() => nav(-1)}>
      <div style={{ margin: '0 12px 12px' }}>
        <Button block fill="outline" color="primary" size="small" onClick={fillDefaults}>
          一键填充示例值
        </Button>
      </div>
      <Form
        form={form}
        layout="vertical"
        mode="card"
        footer={
          <Space direction="vertical" block>
            <Button block color="primary" size="large" loading={loading} onClick={submit}>
              保存
            </Button>
          </Space>
        }
      >
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder={DEFAULTS.name} />
        </Form.Item>
        <Form.Item name="url" label="URL" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder={DEFAULTS.url} />
        </Form.Item>
        <Form.Item name="token" label="API Token" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder={DEFAULTS.token} />
        </Form.Item>
        <Form.Item name="is_default" label="设为默认" childElementPosition="right">
          <Switch />
        </Form.Item>
      </Form>
    </PageShell>
  )
}
