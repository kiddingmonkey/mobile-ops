import { useState } from 'react'
import { Form, Switch, Selector, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import NativeInput from '@/components/NativeInput'
import { api, friendlyApiError } from '@/api/client'

export default function PromNewPage() {
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    try {
      const v = await form.validateFields()
      if (Array.isArray(v.auth_type)) v.auth_type = v.auth_type[0]
      setLoading(true)
      await api.createProm(v)
      Toast.show({ content: '添加成功', icon: 'success' })
      nav(-1)
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail', duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell title="添加 Prometheus" onBack={() => nav(-1)}>
      <Form
        form={form}
        layout="vertical"
        mode="card"
        initialValues={{ auth_type: ['none'] }}
        footer={
          <Button block color="primary" size="large" loading={loading} onClick={submit}>
            保存
          </Button>
        }
      >
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="内网 vmselect" />
        </Form.Item>
        <Form.Item name="url" label="URL" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="http://172.22.67.24:11002/select/0/prometheus" />
        </Form.Item>
        <Form.Item name="auth_type" label="认证方式">
          <Selector
            columns={3}
            options={[
              { label: '无', value: 'none' },
              { label: 'Bearer', value: 'bearer' },
              { label: 'Basic', value: 'basic' }
            ]}
          />
        </Form.Item>
        <Form.Item name="auth" label="凭证（Bearer Token 或 user:pass，无认证留空）">
          <NativeInput placeholder="" usePlaceholderAsDefault={false} />
        </Form.Item>
        <Form.Item name="is_default" label="设为默认" childElementPosition="right">
          <Switch />
        </Form.Item>
      </Form>
    </PageShell>
  )
}
