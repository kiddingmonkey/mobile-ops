import { useRef, useState } from 'react'
import { Toast } from 'antd-mobile'
import { api, friendlyApiError } from '@/api/client'
import HoldToConfirm from './HoldToConfirm'
import { pushBridgeEvent } from './BridgeTicker'
import { recordEvent, Badge } from './achievements'
import { fireCaptainReaction } from './captainReactions'

/**
 * 舰桥内节点池扩容
 * - 选择节点池 + delta（+1/+2/+3/-1）
 * - 长按蓄力（precheck 已过时的话在提交时兜底 precheck）
 * - 触发轨道打击 + 写日志 + 通知父组件 badge 解锁
 */

export default function InBridgeScale({
  clusterId,
  clusterName,
  pools,
  onStrike,
  onBadgesUnlocked,
}: {
  clusterId: number
  clusterName: string
  pools: any[]
  onStrike?: (x: number, y: number, color?: string) => void
  onBadgesUnlocked?: (b: Badge[]) => void
}) {
  const [poolId, setPoolId] = useState<number | null>(
    pools.length > 0 ? (pools[0].id ?? pools[0].pool_id ?? null) : null
  )
  const [delta, setDelta] = useState<number>(1)
  const [submitting, setSubmitting] = useState(false)
  const targetRef = useRef<HTMLDivElement>(null)

  if (pools.length === 0) {
    return (
      <div style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        padding: '12px 0',
        letterSpacing: '0.1em',
      }}>
        ◇ NO POOLS · 该集群无可扩容节点池
      </div>
    )
  }

  const pool = pools.find((p: any) => (p.id ?? p.pool_id) === poolId) || pools[0]
  const currentSize = pool.current_size ?? pool.desired_size ?? 0
  const targetSize = currentSize + delta
  const isShrink = delta < 0
  const color = isShrink ? 'var(--warning)' : 'var(--hd-cyan)'
  const glowColor = isShrink ? 'rgba(251, 191, 36, 0.6)' : 'var(--hd-cyan-glow)'

  const execute = async (x: number, y: number) => {
    if (poolId === null) return
    setSubmitting(true)
    Toast.show({ icon: 'loading', content: isShrink ? '正在回收...' : '正在空投增援...', duration: 0 })
    onStrike?.(x, y, color)

    try {
      const precheck = await api.scalePrecheck({
        cluster_id: clusterId,
        node_pool_id: poolId,
        delta,
      })
      const r = await api.scaleSubmit({
        cluster_id: clusterId,
        node_pool_id: poolId,
        delta,
        precheck,
        trigger_source: 'holodeck',
      })
      Toast.clear()
      Toast.show({ icon: 'success', content: isShrink ? '已回收' : '增援已投放' })

      pushBridgeEvent(
        'success',
        `${isShrink ? 'SCALE-DOWN' : 'SCALE-UP'} · [${clusterName.toUpperCase()}] ${pool.name || `pool-${poolId}`} · ${currentSize}→${targetSize} · op=${r.operation_id?.slice(0, 8) || 'N/A'}`
      )
      fireCaptainReaction({ type: 'scale_success', delta, poolName: pool.name || `pool-${poolId}` })

      const unlocked = recordEvent({ type: 'op_executed' })
      if (unlocked.length) onBadgesUnlocked?.(unlocked)
    } catch (e) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
      pushBridgeEvent('error', `SCALE FAILED · ${pool.name || `pool-${poolId}`} · ${(e as any)?.message || 'unknown'}`)
      fireCaptainReaction({ type: 'scale_failed', poolName: pool.name || `pool-${poolId}` })
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = () => {
    const el = targetRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      const x = ((r.left + r.width / 2) / window.innerWidth) * 100
      const y = ((r.top + r.height / 2) / window.innerHeight) * 100
      execute(x, y)
    } else {
      execute(50, 50)
    }
  }

  return (
    <div ref={targetRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 节点池选择 */}
      {pools.length > 1 && (
        <div>
          <div style={{
            fontSize: 9,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.2em',
            marginBottom: 4,
          }}>
            POOL
          </div>
          <select
            value={poolId ?? ''}
            onChange={e => setPoolId(parseInt(e.target.value))}
            style={{
              width: '100%',
              background: 'rgba(5, 10, 25, 0.7)',
              border: '1px solid rgba(120, 200, 255, 0.25)',
              color: 'var(--text-primary)',
              padding: '6px 8px',
              fontSize: 11,
              fontFamily: 'inherit',
              outline: 'none',
              borderRadius: 2,
            }}
          >
            {pools.map((p: any) => (
              <option key={p.id ?? p.pool_id} value={p.id ?? p.pool_id}>
                {p.name || p.pool_name || `pool-${p.id ?? p.pool_id}`}
                {' · '}{p.current_size ?? p.desired_size ?? 0}n
              </option>
            ))}
          </select>
        </div>
      )}

      {/* delta 选择 */}
      <div>
        <div style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.2em',
          marginBottom: 4,
        }}>
          DELTA
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {[-1, 1, 2, 3].map(d => {
            const selected = delta === d
            return (
              <button
                key={d}
                onClick={() => setDelta(d)}
                className="hd-btn"
                style={{
                  fontSize: 12,
                  padding: '8px 0',
                  background: selected ? (d < 0 ? 'rgba(251,191,36,0.2)' : 'rgba(79,195,247,0.2)') : 'transparent',
                  borderColor: selected ? (d < 0 ? 'var(--warning)' : 'var(--hd-cyan)') : 'rgba(120, 200, 255, 0.3)',
                  color: selected ? (d < 0 ? 'var(--warning)' : 'var(--hd-cyan)') : 'var(--text-secondary)',
                  boxShadow: selected ? `0 0 12px ${d < 0 ? 'rgba(251,191,36,0.5)' : 'var(--hd-cyan-glow)'}` : 'none',
                  textShadow: 'none',
                }}
              >
                {d > 0 ? `+${d}` : d}
              </button>
            )
          })}
        </div>
      </div>

      {/* 变化预览 */}
      <div style={{
        padding: '8px 10px',
        background: 'rgba(10, 20, 45, 0.5)',
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div className="hd-text-mono" style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
          {currentSize} <span style={{ color: 'var(--text-tertiary)' }}>→</span> <span style={{ color, fontWeight: 700 }}>{targetSize}</span>
          {' nodes'}
        </div>
        <div className="hd-text-mono" style={{ fontSize: 9, color, letterSpacing: '0.15em' }}>
          {isShrink ? 'RECALL' : 'DEPLOY'}
        </div>
      </div>

      {/* 长按蓄力 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 4,
      }}>
        <HoldToConfirm
          label={isShrink ? 'HOLD · 回收' : 'HOLD · 空投增援'}
          duration={2000}
          color={color}
          glowColor={glowColor}
          onConfirm={handleConfirm}
          disabled={submitting || poolId === null}
        />
        <div style={{ flex: 1, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          长按左侧充能环 2s<br />
          {isShrink ? '回收多余节点' : '从轨道投放增援节点'}
        </div>
      </div>
    </div>
  )
}
