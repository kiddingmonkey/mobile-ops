import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { fmtRelative } from '@/utils/format'
import PanelShell from './PanelShell'
import TaskInspector from '@/components/holodeck/TaskInspector'

const STATUS_COLOR: Record<string, string> = {
  success: '#4ade80',
  failed: '#ff3b5c',
  executing: '#fbbf24',
  polling: '#fbbf24',
  pending: '#4fc3f7',
  prechecking: '#4fc3f7',
}

export default function TasksPanel({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [ops, setOps] = useState<any[]>([])
  const [inspect, setInspect] = useState<any | null>(null)

  const load = () => api.listOperations(50).then(o => setOps(o || [])).catch(() => {})

  useEffect(() => { load() }, [])

  const running = ops.filter(o => ['executing', 'polling', 'pending', 'prechecking'].includes(o.status))
  const done = ops.filter(o => ['success', 'failed'].includes(o.status)).slice(0, 20)

  const actionIcon = (a: string) => a === 'scale_up' ? '⬆️' : a === 'scale_down' ? '⬇️' : a === 'restart' ? '🔄' : '⚙️'
  const actionLabel = (a: string) => a === 'scale_up' ? '扩容' : a === 'scale_down' ? '缩容' : a === 'restart' ? '重启' : a

  return (
    <>
      <PanelShell title="任务中心" titleEn="TASKS" color="#a78bfa" onClose={onClose}>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(167,139,250,0.25)', padding: '0 12px' }}>
          <div style={{ padding: '10px 0', color: '#a78bfa', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.2em' }}>
            RUNNING {running.length} · DONE {done.length}
          </div>
          <button
            onClick={() => nav('/tasks')}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#4fc3f7',
              padding: '10px 8px',
              fontSize: 10,
              letterSpacing: '0.2em',
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer',
            }}
          >
            全屏 →
          </button>
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {running.length > 0 && (
            <>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: '0.25em',
                color: '#fbbf24',
                textShadow: '0 0 6px #fbbf24',
              }}>
                ◇ RUNNING · 进行中
              </div>
              {running.map(o => (
                <TaskCard key={o.id} op={o} icon={actionIcon(o.action)} label={actionLabel(o.action)} onClick={() => setInspect(o)} />
              ))}
            </>
          )}

          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.25em',
            color: '#4ade80',
            textShadow: '0 0 6px #4ade80',
            marginTop: 6,
          }}>
            ◇ RECENT · 最近
          </div>
          {done.length === 0 && running.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'rgba(220,240,255,0.5)',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.2em',
              fontSize: 12,
            }}>
              ◇ NO MISSIONS<br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>暂无任务</span>
            </div>
          ) : (
            done.map(o => (
              <TaskCard key={o.id} op={o} icon={actionIcon(o.action)} label={actionLabel(o.action)} onClick={() => setInspect(o)} />
            ))
          )}
        </div>
      </PanelShell>

      {inspect && (
        <TaskInspector task={inspect} onClose={() => setInspect(null)} onRefresh={load} />
      )}
    </>
  )
}

function TaskCard({ op, icon, label, onClick }: { op: any; icon: string; label: string; onClick: () => void }) {
  const color = STATUS_COLOR[op.status] || '#4fc3f7'
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(10, 20, 45, 0.5)',
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(220,240,255,0.95)' }}>
          {label} {op.delta ? `${op.delta > 0 ? '+' : ''}${op.delta}` : ''}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: 'rgba(220,240,255,0.55)',
          marginTop: 2,
        }}>
          {op.cluster_name || `cluster-${op.cluster_id}`} · {op.node_pool_name || '-'} · {fmtRelative(op.created_at || op.started_at)}
        </div>
      </div>
      <span style={{ fontSize: 10, color, letterSpacing: '0.15em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
        {op.status.toUpperCase()}
      </span>
    </div>
  )
}
