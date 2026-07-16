import { useState } from 'react'
import { Form, Switch, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import NativeInput from '@/components/NativeInput'
import { api, friendlyApiError } from '@/api/client'

export default function GrafanaNewPage() {
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const submit = async () => {
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
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="内网 Grafana" />
        </Form.Item>
        <Form.Item name="url" label="URL" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="http://172.22.211.72:3000" />
        </Form.Item>
        <Form.Item name="token" label="API Token" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="eyJrIjoi..." />
        </Form.Item>
        <Form.Item name="is_default" label="设为默认" childElementPosition="right">
          <Switch />
        </Form.Item>
      </Form>
    </PageShell>
  )
}
