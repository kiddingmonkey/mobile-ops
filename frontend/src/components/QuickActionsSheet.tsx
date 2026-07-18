import { Popup, Dialog, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { hapticMedium, hapticSuccess, hapticError, hapticHeavy } from '@/utils/haptics'

/**
 * 通用资源快捷操作底部弹窗
 * 支持: 扩容/日志/监控/YAML/重启/删除
 */

export interface QuickActionsProps {
  visible: boolean
  onClose: () => void
  resource: {
    tab: string           // 'pods' / 'deployments' / 'statefulsets' 等
    name: string
    namespace?: string
    clusterId: number
    replicas?: number     // deployments/statefulsets 用
  } | null
  onRefresh?: () => void  // 操作完成后回调
}

export default function QuickActionsSheet({ visible, onClose, resource, onRefresh }: QuickActionsProps) {
  const nav = useNavigate()
  if (!resource) return null

  const { tab, name, namespace, clusterId, replicas } = resource
  const isWorkload = ['deployments', 'statefulsets'].includes(tab)
  const isPod = tab === 'pods'
  const canRestart = ['pods', 'deployments', 'statefulsets', 'daemonsets'].includes(tab)

  const doAction = async (fn: () => Promise<any>, successMsg: string) => {
    try {
      await fn()
      hapticSuccess()
      Toast.show({ content: successMsg, icon: 'success' })
      onClose()
      onRefresh?.()
    } catch (e: any) {
      hapticError()
      Toast.show({ content: '失败: ' + (e?.response?.data?.error || e?.message || ''), icon: 'fail' })
    }
  }

  // 扩容
  const scale = async () => {
    const cur = replicas ?? 1
    const val = prompt(`副本数 (当前 ${cur}):`, String(cur))
    if (val == null) return
    const rep = parseInt(val)
    if (isNaN(rep) || rep < 0) {
      Toast.show({ content: '请输入非负整数', icon: 'fail' })
      return
    }
    hapticMedium()
    await doAction(
      () => api.post(`/clusters/${clusterId}/workloads/${tab}/${namespace}/${name}/scale`, { replicas: rep }),
      `已扩缩容到 ${rep}`
    )
  }

  // 重启
  const restart = async () => {
    const ok = await Dialog.confirm({
      content: `确认重启 ${name}？`,
      confirmText: '重启', cancelText: '取消'
    })
    if (!ok) return
    hapticHeavy()

    if (isPod) {
      // Pod 直接删除，让上层 controller 重建
      await doAction(
        () => api.delete(`/clusters/${clusterId}/pods/${namespace}/${name}`),
        '已触发重启（Pod 已删除，控制器会重建）'
      )
    } else {
      await doAction(
        () => api.post(`/clusters/${clusterId}/workloads/${tab}/${namespace}/${name}/restart`),
        '已触发滚动重启'
      )
    }
  }

  // 删除资源
  const del = async () => {
    const ok = await Dialog.confirm({
      content: `确认删除 ${name}？此操作不可撤销`,
      confirmText: '删除', cancelText: '取消'
    })
    if (!ok) return
    hapticHeavy()
    const apiVersion = guessApiVersion(tab)
    const kind = guessKind(tab)
    await doAction(
      () => api.delete(`/clusters/${clusterId}/resources/delete`, {
        params: { apiVersion, kind, namespace, name }
      }),
      '已删除'
    )
  }

  const btnStyle: React.CSSProperties = {
    padding: '14px 16px',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderBottom: '1px solid var(--border-color)',
    cursor: 'pointer',
    minHeight: 48
  }

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        background: 'var(--bg-elevated)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      {/* 顶部标题栏 - 带返回按钮 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 16px', borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        borderTopLeftRadius: 16, borderTopRightRadius: 16
      }}>
        <div onClick={onClose} style={{
          fontSize: 20, color: 'var(--text-secondary)',
          cursor: 'pointer', padding: '0 4px'
        }}>×</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {tab} · {namespace || '-'}
          </div>
        </div>
      </div>

      {/* 操作列表 */}
      <div>
        {isWorkload && (
          <div style={btnStyle} onClick={scale}>
            <span style={{ fontSize: 18 }}>🔢</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>调整副本数</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>当前 {replicas ?? '-'} 副本</div>
            </div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>›</span>
          </div>
        )}

        {isPod && (
          <div style={btnStyle} onClick={() => { onClose(); nav(`/clusters/${clusterId}/pods/${namespace}/${name}`) }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>查看日志</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>实时日志流</div>
            </div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>›</span>
          </div>
        )}

        {isPod && (
          <div style={btnStyle} onClick={() => { onClose(); nav(`/clusters/${clusterId}/pods/${namespace}/${name}`) }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>查看监控</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>CPU/内存/网络/磁盘</div>
            </div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>›</span>
          </div>
        )}

        {isPod && (
          <div style={btnStyle} onClick={() => { onClose(); nav(`/clusters/${clusterId}/pods/${namespace}/${name}`) }}>
            <span style={{ fontSize: 18 }}>💻</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Web 终端</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>进入容器 shell</div>
            </div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>›</span>
          </div>
        )}

        {/* YAML 编辑 - 所有资源类型都支持 */}
        <div style={btnStyle} onClick={() => {
          onClose()
          if (isPod) {
            nav(`/clusters/${clusterId}/pods/${namespace}/${name}`)
          } else {
            nav(`/clusters/${clusterId}/resources/${tab}/${namespace}/${name}`)
          }
        }}>
          <span style={{ fontSize: 18 }}>📝</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>编辑 YAML</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>查看或修改配置</div>
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>›</span>
        </div>

        {canRestart && (
          <div style={btnStyle} onClick={restart}>
            <span style={{ fontSize: 18 }}>🔄</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--warning)', fontWeight: 500 }}>{isPod ? '删除并重建' : '滚动重启'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{isPod ? '删除 Pod, 控制器会自动重建' : '所有副本会依次重启'}</div>
            </div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>›</span>
          </div>
        )}

        <div style={{ ...btnStyle, borderBottom: 'none' }} onClick={del}>
          <span style={{ fontSize: 18 }}>🗑️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--danger)', fontWeight: 500 }}>删除资源</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>不可撤销</div>
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>›</span>
        </div>
      </div>
    </Popup>
  )
}

function guessApiVersion(tab: string): string {
  const map: Record<string, string> = {
    pods: 'v1', services: 'v1', configmaps: 'v1', secrets: 'v1', nodes: 'v1',
    deployments: 'apps/v1', statefulsets: 'apps/v1', daemonsets: 'apps/v1',
    ingresses: 'networking.k8s.io/v1'
  }
  return map[tab] || 'v1'
}

function guessKind(tab: string): string {
  const map: Record<string, string> = {
    pods: 'Pod', services: 'Service', configmaps: 'ConfigMap', secrets: 'Secret',
    deployments: 'Deployment', statefulsets: 'StatefulSet', daemonsets: 'DaemonSet',
    ingresses: 'Ingress', nodes: 'Node'
  }
  return map[tab] || 'Pod'
}
