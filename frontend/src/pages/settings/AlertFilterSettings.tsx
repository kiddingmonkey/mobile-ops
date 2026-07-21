import { useEffect, useState } from 'react'
import { NavBar, Card, Button, Toast, Input, Tag, Radio, Space, Dialog } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'

type Operator = 'AND' | 'OR' | 'NOT'
type ConditionType = 'cluster' | 'system_name' | 'exported_system_name' | 'alertname' | 'namespace'

interface Condition {
  field: ConditionType
  operator: Operator
  values: string[]
}

interface FilterConfig {
  conditions: Condition[]
  staleDays: number
  logicMode: 'mine' | 'ignore' // 此规则是"我的告警"还是"忽略告警"
}

const DEFAULT_CONFIG: FilterConfig = {
  conditions: [
    { field: 'cluster', operator: 'OR', values: ['jyyun'] }
  ],
  staleDays: 3,
  logicMode: 'mine'
}

const FIELD_LABELS: Record<ConditionType, string> = {
  cluster: '集群',
  system_name: '系统名称',
  exported_system_name: '导出系统名称',
  alertname: '告警名称',
  namespace: '命名空间',
}

export default function AlertFilterSettingsPage() {
  const nav = useNavigate()
  const [config, setConfig] = useState<FilterConfig>(() => {
    try {
      const saved = localStorage.getItem('alert_filter_config_v2')
      if (saved) return JSON.parse(saved)
      // 兼容旧配置
      const oldSaved = localStorage.getItem('alert_filter_config')
      if (oldSaved) {
        const old = JSON.parse(oldSaved)
        return {
          conditions: [
            { field: 'cluster', operator: 'OR', values: old.clusterValues || ['jyyun'] },
            ...(old.systemNameValues?.length ? [{ field: 'system_name', operator: 'OR', values: old.systemNameValues }] : [])
          ],
          staleDays: old.staleDays || 3,
          logicMode: 'mine'
        }
      }
      return DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  })

  const save = (c: FilterConfig) => {
    setConfig(c)
    localStorage.setItem('alert_filter_config_v2', JSON.stringify(c))
    Toast.show({ icon: 'success', content: '已保存' })
  }

  const addCondition = () => {
    save({
      ...config,
      conditions: [...config.conditions, { field: 'cluster', operator: 'OR', values: [] }]
    })
  }

  const updateCondition = (index: number, updated: Condition) => {
    const newConditions = [...config.conditions]
    newConditions[index] = updated
    save({ ...config, conditions: newConditions })
  }

  const deleteCondition = (index: number) => {
    save({ ...config, conditions: config.conditions.filter((_, i) => i !== index) })
  }

  const addValue = (index: number, value: string) => {
    if (!value.trim()) return
    const cond = config.conditions[index]
    updateCondition(index, { ...cond, values: [...cond.values, value.trim()] })
  }

  const removeValue = (index: number, value: string) => {
    const cond = config.conditions[index]
    updateCondition(index, { ...cond, values: cond.values.filter(v => v !== value) })
  }

  // 生成策略表达式
  const generateExpression = () => {
    if (config.conditions.length === 0) return '无条件（匹配所有告警）'

    const parts = config.conditions.map(cond => {
      const fieldName = FIELD_LABELS[cond.field]
      if (cond.values.length === 0) return `${fieldName} 未设置`

      const valueStr = cond.values.map(v => `"${v}"`).join(', ')

      if (cond.operator === 'OR') {
        return `${fieldName} 属于 [${valueStr}]`
      } else if (cond.operator === 'AND') {
        return `${fieldName} 同时匹配 [${valueStr}]`
      } else {
        return `${fieldName} 不属于 [${valueStr}]`
      }
    })

    // 条件之间是 AND 关系
    return parts.join(' 且 ')
  }

  // 生成逻辑说明
  const generateLogicDescription = () => {
    const expr = generateExpression()
    const autoIgnore = `超过 ${config.staleDays} 天的告警自动忽略`

    return (
      <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-primary)' }}>
          📋 当前策略表达式
        </div>
        <div style={{
          padding: '10px 12px',
          background: 'rgba(79, 195, 247, 0.1)',
          border: '1px solid rgba(79, 195, 247, 0.3)',
          borderLeft: '3px solid var(--hd-cyan)',
          borderRadius: 4,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          marginBottom: 12,
        }}>
          {expr}
        </div>
        <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-primary)' }}>
          🔍 策略逻辑说明
        </div>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>多个条件之间是 <strong>与（AND）</strong> 关系，必须全部满足</li>
          <li>单个条件内的多个值：
            <ul style={{ marginTop: 4 }}>
              <li><strong>OR（或）</strong>：满足任意一个值即可</li>
              <li><strong>AND（与）</strong>：必须同时匹配所有值（少用）</li>
              <li><strong>NOT（非）</strong>：不能匹配任何一个值</li>
            </ul>
          </li>
          <li>集群匹配 → 系统匹配 → 其他条件，<strong>优先级从左到右递减</strong></li>
          <li>{autoIgnore}</li>
        </ul>
      </div>
    )
  }

  return (
    <div className="page">
      <NavBar onBack={() => nav(-1)}>告警策略配置</NavBar>
      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>

        {/* 策略表达式展示 */}
        <Card style={{ marginBottom: 16, background: 'var(--bg-elevated)' }}>
          {generateLogicDescription()}
        </Card>

        {/* 条件列表 */}
        {config.conditions.map((cond, idx) => (
          <ConditionCard
            key={idx}
            condition={cond}
            index={idx}
            onUpdate={(updated) => updateCondition(idx, updated)}
            onDelete={() => deleteCondition(idx)}
            onAddValue={(value) => addValue(idx, value)}
            onRemoveValue={(value) => removeValue(idx, value)}
          />
        ))}

        <Button
          block
          color="primary"
          fill="outline"
          onClick={addCondition}
          style={{ marginBottom: 16 }}
        >
          ➕ 添加条件
        </Button>

        {/* 自动忽略策略 */}
        <Card title="⏰ 自动忽略策略" style={{ marginBottom: 16 }}>
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

        <div style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          padding: '12px',
          background: 'var(--bg-elevated)',
          borderRadius: 8,
          lineHeight: 1.6,
        }}>
          💡 提示：策略配置后立即生效，刷新告警列表查看效果。策略越精确，"我的告警"数量越少，越容易聚焦关键问题。
        </div>
      </div>
    </div>
  )
}

function ConditionCard({
  condition,
  index,
  onUpdate,
  onDelete,
  onAddValue,
  onRemoveValue,
}: {
  condition: Condition
  index: number
  onUpdate: (updated: Condition) => void
  onDelete: () => void
  onAddValue: (value: string) => void
  onRemoveValue: (value: string) => void
}) {
  const [newValue, setNewValue] = useState('')

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>条件 #{index + 1}</span>
          <Button
            size="mini"
            color="danger"
            fill="none"
            onClick={onDelete}
            style={{ fontSize: 11 }}
          >
            删除
          </Button>
        </div>
      }
      style={{ marginBottom: 12 }}
    >
      {/* 字段选择 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>匹配字段</div>
        <Radio.Group
          value={condition.field}
          onChange={(val) => onUpdate({ ...condition, field: val as ConditionType })}
        >
          <Space direction="horizontal" wrap>
            {(Object.keys(FIELD_LABELS) as ConditionType[]).map(field => (
              <Radio key={field} value={field} style={{ fontSize: 12 }}>
                {FIELD_LABELS[field]}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </div>

      {/* 逻辑运算符 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>逻辑运算符</div>
        <Radio.Group
          value={condition.operator}
          onChange={(val) => onUpdate({ ...condition, operator: val as Operator })}
        >
          <Space direction="horizontal">
            <Radio value="OR" style={{ fontSize: 12 }}>或（OR）</Radio>
            <Radio value="AND" style={{ fontSize: 12 }}>与（AND）</Radio>
            <Radio value="NOT" style={{ fontSize: 12 }}>非（NOT）</Radio>
          </Space>
        </Radio.Group>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {condition.operator === 'OR' && '满足任意一个值即可'}
          {condition.operator === 'AND' && '必须同时匹配所有值'}
          {condition.operator === 'NOT' && '不能匹配任何一个值'}
        </div>
      </div>

      {/* 值列表 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
          匹配值（{condition.values.length}）
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {condition.values.length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>未设置（点击下方添加）</span>
          )}
          {condition.values.map((v: string) => (
            <Tag
              key={v}
              color="primary"
              fill="outline"
              style={{ fontSize: 11 }}
              onClick={() => onRemoveValue(v)}
            >{v} ×</Tag>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Input
            placeholder={`输入 ${FIELD_LABELS[condition.field]} 值`}
            value={newValue}
            onChange={v => setNewValue(v)}
            onEnterPress={() => {
              onAddValue(newValue)
              setNewValue('')
            }}
            style={{ flex: 1, fontSize: 12 }}
          />
          <Button
            size="small"
            color="primary"
            onClick={() => {
              onAddValue(newValue)
              setNewValue('')
            }}
          >
            添加
          </Button>
        </div>
      </div>
    </Card>
  )
}
