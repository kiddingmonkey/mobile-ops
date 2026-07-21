import { Dialog } from 'antd-mobile'

/**
 * 全息舰桥二次确认对话框
 * 所有变更操作必须通过此组件确认，展示中文操作描述、风险和后果
 */

export interface ConfirmAction {
  title: string // 操作标题，如"静默告警"
  action: string // 具体动作描述，如"将 HighMemoryUsage 告警静默 1 小时"
  risk: string // 风险说明，如"静默期间该告警将不再触发通知"
  consequence: string // 后果说明，如"可能导致内存溢出问题被延迟发现"
  confirmText?: string // 确认按钮文字，默认"确认执行"
  color?: string // 主题色
}

export function showConfirmDialog(action: ConfirmAction): Promise<boolean> {
  return new Promise((resolve) => {
    Dialog.confirm({
      title: (
        <div style={{
          fontSize: 16,
          fontWeight: 700,
          color: action.color || 'var(--hd-cyan)',
          letterSpacing: '0.05em',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {action.title}
        </div>
      ),
      content: (
        <div style={{
          fontSize: 13,
          lineHeight: 1.8,
          color: 'var(--text-primary)',
        }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 11, letterSpacing: '0.15em' }}>操作内容</span>
            <div style={{
              marginTop: 4,
              padding: '8px 10px',
              background: 'rgba(10, 20, 45, 0.5)',
              border: `1px solid ${action.color || 'var(--hd-cyan)'}40`,
              borderLeft: `3px solid ${action.color || 'var(--hd-cyan)'}`,
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {action.action}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={{ color: 'var(--warning)', fontSize: 11, letterSpacing: '0.15em' }}>⚠️ 风险</span>
            <div style={{
              marginTop: 4,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}>
              {action.risk}
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--hd-emergency)', fontSize: 11, letterSpacing: '0.15em' }}>⚡ 后果</span>
            <div style={{
              marginTop: 4,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}>
              {action.consequence}
            </div>
          </div>
        </div>
      ),
      confirmText: action.confirmText || '确认执行',
      cancelText: '取消',
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

/**
 * 预定义的常见变更操作确认配置
 */
export const CONFIRM_ACTIONS = {
  // 告警静默
  silenceAlert: (alertName: string, duration: string): ConfirmAction => ({
    title: '静默告警',
    action: `将「${alertName}」告警静默 ${duration}`,
    risk: `静默期间该告警将不再触发飞书通知、短信和电话`,
    consequence: `如果是关键告警（如数据库故障、服务不可用），可能导致问题被延迟发现，造成业务损失`,
    color: 'var(--warning)',
  }),

  // 扩容
  scaleUp: (clusterName: string, poolName: string, from: number, to: number, delta: number): ConfirmAction => ({
    title: '节点池扩容',
    action: `集群「${clusterName}」节点池「${poolName}」扩容 ${delta} 个节点（${from} → ${to}）`,
    risk: `新节点启动需要 3-5 分钟，期间集群整体容量不变`,
    consequence: `每个节点约 ¥0.5-2/小时成本，确认当前业务确实需要更多资源`,
    color: 'var(--hd-cyan)',
  }),

  // 缩容
  scaleDown: (clusterName: string, poolName: string, from: number, to: number, delta: number): ConfirmAction => ({
    title: '节点池缩容',
    action: `集群「${clusterName}」节点池「${poolName}」缩容 ${Math.abs(delta)} 个节点（${from} → ${to}）`,
    risk: `节点上的 Pod 会被驱逐并重新调度到其他节点，可能触发短暂的服务抖动`,
    consequence: `如果当前集群资源已经紧张，缩容后可能导致部分 Pod 无法调度（Pending 状态）`,
    color: 'var(--warning)',
    confirmText: '确认缩容',
  }),

  // 重启工作负载
  restartWorkload: (type: string, namespace: string, name: string): ConfirmAction => ({
    title: '重启工作负载',
    action: `重启 ${type}/${namespace}/${name}`,
    risk: `重启期间该服务将短暂不可用（约 10-60 秒），已有连接会被中断`,
    consequence: `如果是核心服务且无多副本保护，用户请求会失败；如果有存储卷挂载问题，重启后可能无法启动`,
    color: 'var(--hd-emergency)',
    confirmText: '确认重启',
  }),

  // 删除资源
  deleteResource: (type: string, namespace: string, name: string): ConfirmAction => ({
    title: '删除资源',
    action: `删除 ${type}/${namespace}/${name}`,
    risk: `删除后无法恢复，该资源的所有配置、数据（如 PVC）都会丢失`,
    consequence: `如果是核心服务，删除后用户请求将全部失败；如果有其他资源依赖此资源，可能触发级联故障`,
    color: 'var(--hd-emergency)',
    confirmText: '确认删除（不可恢复）',
  }),

  // 自定义操作
  custom: (action: ConfirmAction) => action,
}
