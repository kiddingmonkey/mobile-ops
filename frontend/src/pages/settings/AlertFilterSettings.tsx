import { useEffect, useState } from 'react'
import { NavBar, Card, Button, Toast, Input, Tag } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'

const DEFAULT_CONFIG = {
  clusterValues: ['jyyun'],
  systemNameValues: [] as string[],
  staleDays: 3
}

export default function AlertFilterSettingsPage() {
  const nav = useNavigate()
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('alert_filter_config')
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  })
  const [newCluster, setNewCluster] = useState('')
  const [newSystem, setNewSystem] = useState('')

  const save = (c: typeof config) => {
    setConfig(c)
    localStorage.setItem('alert_filter_config', JSON.stringify(c))
    Toast.show({ icon: 'success', content: '已保存' })
  }

  return (
    <div className="page">
      <NavBar onBack={() => nav(-1)}>告警分类策略</NavBar>
      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>

        <Card title="集群匹配 (cluster)" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            匹配告警 labels 中 cluster 字段的值，匹配的归入"我的告警"
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {config.clusterValues.map((v: string) => (
              <Tag
                key={v}
                color="primary"
                fill="outline"
                style={{ fontSize: 12 }}
                onClick={() => save({ ...config, clusterValues: config.clusterValues.filter((x: string) => x !== v) })}
              >{v} ×</Tag>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input
              placeholder="输入 cluster 值"
              value={newCluster}
              onChange={v => setNewCluster(v)}
              style={{ flex: 1, fontSize: 12 }}
            />
            <Button size="small" color="primary" onClick={() => {
              if (!newCluster.trim()) return
              save({ ...config, clusterValues: [...config.clusterValues, newCluster.trim()] })
              setNewCluster('')
            }}>添加</Button>
          </div>
        </Card>

        <Card title="系统匹配 (system_name / exported_system_name)" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            在 cluster 匹配后，继续匹配 system_name 或 exported_system_name。留空表示不限制。
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {config.systemNameValues.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>不限制（显示该 cluster 所有告警）</span>
            )}
            {config.systemNameValues.map((v: string) => (
              <Tag
                key={v}
                color="success"
                fill="outline"
                style={{ fontSize: 12 }}
                onClick={() => save({ ...config, systemNameValues: config.systemNameValues.filter((x: string) => x !== v) })}
              >{v} ×</Tag>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Input
              placeholder="输入 system_name 值"
              value={newSystem}
              onChange={v => setNewSystem(v)}
              style={{ flex: 1, fontSize: 12 }}
            />
            <Button size="small" color="primary" onClick={() => {
              if (!newSystem.trim()) return
              save({ ...config, systemNameValues: [...config.systemNameValues, newSystem.trim()] })
              setNewSystem('')
            }}>添加</Button>
          </div>
        </Card>

        <Card title="自动忽略策略" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            超过指定天数仍在 firing 的告警，自动归入"已忽略"列表
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>超过</span>
            <Input
              type="number"
              value={String(config.staleDays)}
              onChange={v => save({ ...config, staleDays: Number(v) || 3 })}
              style={{ width: 60, fontSize: 12, textAlign: 'center' }}
            />
            <span style={{ fontSize: 12 }}>天自动忽略</span>
          </div>
        </Card>

        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '0 4px' }}>
          分类逻辑：cluster 标签匹配 → system_name/exported_system_name 匹配 → 归入"我的告警"，其余归入"其他告警"。超时告警自动进入"已忽略"。
        </div>
      </div>
    </div>
  )
}

