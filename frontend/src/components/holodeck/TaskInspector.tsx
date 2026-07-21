import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { api, friendlyApiError } from '@/api/client'
import { fmtRelative, fmtTime } from '@/utils/format'
import { hapticLight } from '@/utils/haptics'
import { pushBridgeEvent } from './BridgeTicker'
import { fireCaptainReaction } from './captainReactions'

const STATUS_COLOR: Record<string, string> = {
  success: 'var(--success)',
  failed: 'var(--hd-emergency)',
  executing: 'var(--warning)',
  polling: 'var(--warning)',
  pending: 'var(--hd-cyan)',
  prechecking: 'var(--hd-cyan)',
}

const STATUS_GLOW: Record<string, string> = {
  success: 'rgba(52, 211, 153, 0.6)',
  failed: 'rgba(255, 59, 92, 0.6)',
  executing: 'rgba(251, 191, 36, 0.6)',
  polling: 'rgba(251, 191, 36, 0.6)',
  pending: 'rgba(79, 195, 247, 0.6)',
  prechecking: 'rgba(79, 195, 247, 0.6)',
}

interface Props {
  task: any
  onClose: () => void
  onRefresh?: () => void
}

export default function TaskInspector({ task, onClose, onRefresh }: Props) {
  const nav = useNavigate()
  const targetRef = useRef<HTMLDivElement>(null)

  const action = task.action || task.type || 'Unknown'
  const status = task.status || 'unknown'
  const color = STATUS_COLOR[status] || 'var(--hd-cyan)'
  const glowColor = STATUS_GLOW[status] || 'rgba(79, 195, 247, 0.6)'

  const actionIcon = (a: string) => {
    if (a === 'scale_up') return '⬆️'
    if (a === 'scale_down') return '⬇️'
    if (a === 'restart') return '🔄'
    return '⚙️'
  }

  const actionLabel = (a: string) => {
    if (a === 'scale_up') return '扩容'
    if (a === 'scale_down') return '缩容'
    if (a === 'restart') return '重启'
    return a
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case 'success': return '✓ 成功'
      case 'failed': return '✗ 失败'
      case 'executing': return '⏳ 执行中'
      case 'polling': return '🔄 轮询中'
      case 'pending': return '⏸ 等待中'
      case 'prechecking': return '🔍 预检中'
      default: return s
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 5, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9994,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'hd-fade-in 0.3s ease-out',
      }}
    >
      <div
        ref={targetRef}
        onClick={(e) => e.stopPropagation()}
        className="hd-panel"
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderColor: color,
          boxShadow: `0 0 30px ${glowColor}`,
        }}
      >
        <div className="hd-panel-header" style={{ color, textShadow: `0 0 8px ${glowColor}` }}>
          <span>◆ TASK · {status.toUpperCase()}</span>
          <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="hd-text-mono" style={{ fontSize: 10, opacity: 0.7 }}>
              {fmtRelative(task.created_at || task.createdAt || task.started_at)}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: 14,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </span>
        </div>
        <div className="hd-panel-corner tl" />
        <div className="hd-panel-corner tr" />
        <div className="hd-panel-corner bl" />
        <div className="hd-panel-corner br" />

        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 20,
        }}>
          {/* 任务标题 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 32 }}>{actionIcon(action)}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                color: color,
                textShadow: `0 0 12px ${glowColor}`,
                letterSpacing: '0.02em',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {actionLabel(action)}
                {task.delta && (
                  <span style={{ marginLeft: 8, color: task.delta > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {task.delta > 0 ? '+' : ''}{task.delta}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginTop: 4,
              }}>
                {statusLabel(status)}
              </div>
            </div>
          </div>

          {/* 基本信息 */}
          <div style={{
            fontSize: 10,
            letterSpacing: '0.25em',
            color: 'var(--hd-cyan)',
            marginBottom: 10,
          }}>
            ◇ DETAILS
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginBottom: 16,
          }}>
            {task.cluster_name && (
              <InfoCard label="集群" value={task.cluster_name} />
            )}
            {task.node_pool_name && (
              <InfoCard label="节点池" value={task.node_pool_name} />
            )}
            {task.started_at && (
              <InfoCard label="开始时间" value={fmtTime(task.started_at)} />
            )}
            {task.finished_at && (
              <InfoCard label="结束时间" value={fmtTime(task.finished_at)} />
            )}
            {task.trigger_source && (
              <InfoCard label="触发来源" value={task.trigger_source} />
            )}
            {task.operation_id && (
              <InfoCard label="操作ID" value={task.operation_id.slice(0, 12)} />
            )}
          </div>

          {/* 错误信息 */}
          {task.error_msg && (
            <>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                color: 'var(--hd-emergency)',
                marginBottom: 10,
              }}>
                ◇ ERROR
              </div>
              <div style={{
                padding: '10px 12px',
                background: 'rgba(255, 59, 92, 0.1)',
                border: '1px solid var(--hd-emergency)',
                borderLeft: '3px solid var(--hd-emergency)',
                fontSize: 12,
                color: 'var(--text-primary)',
                marginBottom: 16,
                lineHeight: 1.6,
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {task.error_msg}
              </div>
            </>
          )}

          {/* 预检结果 */}
          {task.precheck_result && (
            <>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.25em',
                color: 'var(--hd-cyan)',
                marginBottom: 10,
              }}>
                ◇ PRECHECK
              </div>
              <div style={{
                padding: '10px 12px',
                background: 'rgba(10, 20, 45, 0.55)',
                border: '1px solid rgba(120, 200, 255, 0.3)',
                fontSize: 11,
                color: 'var(--text-secondary)',
                marginBottom: 16,
                lineHeight: 1.6,
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {JSON.stringify(task.precheck_result, null, 2)}
              </div>
            </>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              className="hd-btn"
              onClick={() => {
                hapticLight()
                onRefresh?.()
                Toast.show({ content: '已刷新', duration: 1000 })
              }}
              style={{ flex: 1, fontSize: 12 }}
            >
              ▸ 刷新状态
            </button>
            <button
              className="hd-btn"
              onClick={() => {
                hapticLight()
                onClose()
                nav('/tasks')
              }}
              style={{ flex: 1, fontSize: 12 }}
            >
              ▸ 查看所有任务
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '8px 12px',
      background: 'rgba(10, 20, 45, 0.55)',
      border: '1px solid rgba(120, 200, 255, 0.15)',
      borderRadius: 2,
    }}>
      <div style={{
        fontSize: 9,
        color: 'var(--text-tertiary)',
        marginBottom: 4,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12,
        color: 'var(--hd-cyan)',
        fontFamily: "'JetBrains Mono', monospace",
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  )
}
