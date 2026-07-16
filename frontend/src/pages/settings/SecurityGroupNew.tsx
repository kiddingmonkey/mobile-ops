import { useEffect, useState } from 'react'
import { Form, Selector, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import NativeInput from '@/components/NativeInput'
import { api, friendlyApiError } from '@/api/client'

const TENCENT_REGIONS = [
  'ap-beijing', 'ap-shanghai', 'ap-guangzhou', 'ap-chengdu',
  'ap-nanjing', 'ap-hongkong', 'ap-shenzhen-fsi'
]

const DEFAULTS = {
  name: '运维手机访问 18443',
  sg_id: 'sg-xxxxxxxx',
  port: '18443',
  protocol: 'TCP',
  description: '运维手机白名单'
}

export default function SecurityGroupNewPage() {
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [clouds, setClouds] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.listCloudAccounts().then(setClouds).catch(() => setClouds([]))
  }, [])

  const fillDefaults = () => {
    form.setFieldsValue({
      name: DEFAULTS.name,
      port: DEFAULTS.port,
      protocol: [DEFAULTS.protocol],
      description: DEFAULTS.description
    })
    Toast.show({ content: '已填充示例值', icon: 'success', duration: 1000 })
  }

  const submit = async () => {
    const cur = form.getFieldsValue()
    // 兜底 (敏感字段 sg_id 不兜底)
    const patch: Record<string, any> = {}
    if (!cur.name) patch.name = DEFAULTS.name
    if (!cur.port) patch.port = DEFAULTS.port
    if (!cur.protocol) patch.protocol = [DEFAULTS.protocol]
    if (!cur.description) patch.description = DEFAULTS.description
    if (Object.keys(patch).length) form.setFieldsValue(patch)

    try {
      const v = await form.validateFields()
      const payload: any = {
        name: v.name,
        cloud_account_id: Array.isArray(v.cloud_account_id) ? v.cloud_account_id[0] : v.cloud_account_id,
        region: Array.isArray(v.region) ? v.region[0] : v.region,
        sg_id: v.sg_id,
        port: v.port,
        protocol: Array.isArray(v.protocol) ? v.protocol[0] : v.protocol,
        description: v.description
      }
      setLoading(true)
      await api.createSGWhitelist(payload)
      Toast.show({ content: '添加成功', icon: 'success' })
      nav(-1)
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail', duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell title="新建安全组白名单" onBack={() => nav(-1)}>
      <div style={{
        margin: '0 12px 12px', padding: 10, borderRadius: 8,
        background: 'rgba(74, 126, 248, 0.1)', color: 'var(--accent-blue)', fontSize: 11
      }}>
        💡 通过腾讯云 AK/SK 一键把当前手机公网 IP 加入指定安全组的入站规则。
        点"一键更新"时会按"备注"匹配删除旧规则,再添加新的 IP/32。
      </div>

      <div style={{ margin: '0 12px 12px' }}>
        <Button block fill="outline" color="primary" size="small" onClick={fillDefaults}>
          一键填充示例值
        </Button>
      </div>

      <Form
        form={form}
        layout="vertical"
        mode="card"
        initialValues={{ protocol: ['TCP'], port: '18443' }}
        footer={
          <Button block color="primary" size="large" loading={loading} onClick={submit}>
            保存
          </Button>
        }
      >
        <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder={DEFAULTS.name} />
        </Form.Item>

        <Form.Item name="cloud_account_id" label="腾讯云账号" rules={[{ required: true, message: '必选' }]}>
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
          <NativeInput placeholder="sg-xxxxxxxx" usePlaceholderAsDefault={false} />
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

        <Form.Item name="description" label="规则备注 (用于识别历史规则)" rules={[{ required: true, message: '必填' }]}>
          <NativeInput placeholder={DEFAULTS.description} />
        </Form.Item>
      </Form>
    </PageShell>
  )
}
