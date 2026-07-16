import { useState } from 'react'
import { Form, Selector, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import NativeInput from '@/components/NativeInput'
import { api, friendlyApiError } from '@/api/client'

const TENCENT_REGIONS = [
  'ap-beijing', 'ap-shanghai', 'ap-guangzhou', 'ap-chengdu',
  'ap-nanjing', 'ap-hongkong', 'ap-shenzhen-fsi'
]

export default function CloudNewPage() {
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    try {
      const v = await form.validateFields()
      if (Array.isArray(v.region)) v.region = v.region[0]
      v.provider = 'tencent'
      setLoading(true)
      await api.createCloudAccount(v)
      Toast.show({ content: '添加成功', icon: 'success' })
      nav(-1)
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail', duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell title="添加腾讯云账号" onBack={() => nav(-1)}>
      <div style={{
        margin: '0 12px 16px', padding: 12, borderRadius: 8,
        background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12
      }}>
        ⚠️ AK/SK 会 AES-256 加密后存储。建议使用**只有 TKE 只读+扩缩容权限**的子账号 AK/SK。
      </div>
      <Form
        form={form}
        layout="vertical"
        mode="card"
        initialValues={{ region: ['ap-beijing'] }}
        footer={
          <Button block color="primary" size="large" loading={loading} onClick={submit}>
            保存
          </Button>
        }
      >
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="腾讯云-运维子账号" />
        </Form.Item>
        <Form.Item name="region" label="地域" rules={[{ required: true, message: '必选' }]}>
          <Selector
            columns={3}
            options={TENCENT_REGIONS.map(r => ({ label: r, value: r }))}
          />
        </Form.Item>
        <Form.Item name="secret_id" label="SecretId" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder="AKIDxxxx" usePlaceholderAsDefault={false} />
        </Form.Item>
        <Form.Item name="secret_key" label="SecretKey" rules={[{ required: true, message: '必填' }]}>
          <NativeInput type="password" placeholder="••••••" usePlaceholderAsDefault={false} />
        </Form.Item>
      </Form>
    </PageShell>
  )
}
