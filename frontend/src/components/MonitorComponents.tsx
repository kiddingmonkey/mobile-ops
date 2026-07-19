import React from 'react'
import { Button } from 'antd-mobile'
import { AddOutline, UnorderedListOutline } from 'antd-mobile-icons'

interface CompactHeaderProps {
  onGrafanaManager: () => void
  onAddPanel: () => void
}

export const CompactHeader: React.FC<CompactHeaderProps> = ({ onGrafanaManager, onAddPanel }) => {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-color)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px'
      }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>监控</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" fill="outline" onClick={onGrafanaManager}>
            <UnorderedListOutline fontSize={16} />
          </Button>
          <Button size="small" color="primary" onClick={onAddPanel}>
            <AddOutline fontSize={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface ToolbarProps {
  clusters?: Array<{ id: number; name: string }>
  activeClusterId?: number | null
  onClusterChange?: (id: number) => void
  timeRange?: string
  onTimeRangeChange?: (range: string) => void
  showClusters?: boolean
  showTimeRange?: boolean
}

export const Toolbar: React.FC<ToolbarProps> = ({
  clusters = [],
  activeClusterId,
  onClusterChange,
  timeRange = 'now-1h',
  onTimeRangeChange,
  showClusters = true,
  showTimeRange = true
}) => {
  if (!showClusters && !showTimeRange) return null

  return (
    <div style={{
      padding: '8px 12px',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-color)'
    }}>
      {/* 集群选择 */}
      {showClusters && clusters.length > 1 && (
        <div style={{ marginBottom: showTimeRange ? 8 : 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 5 }}>集群</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {clusters.map(c => (
              <div
                key={c.id}
                onClick={() => onClusterChange?.(c.id)}
                style={{
                  flex: '0 0 auto',
                  padding: '5px 12px',
                  borderRadius: 6,
                  background: activeClusterId === c.id ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                  color: activeClusterId === c.id ? 'white' : 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: activeClusterId === c.id ? 600 : 400,
                  border: activeClusterId === c.id ? 'none' : '1px solid var(--border-color)',
                  whiteSpace: 'nowrap'
                }}
              >
                {c.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 时间范围 */}
      {showTimeRange && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 5 }}>时间范围</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: '1h', value: 'now-1h' },
              { label: '6h', value: 'now-6h' },
              { label: '24h', value: 'now-24h' },
              { label: '7d', value: 'now-7d' }
            ].map(opt => (
              <div
                key={opt.value}
                onClick={() => onTimeRangeChange?.(opt.value)}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: timeRange === opt.value ? 'var(--accent-blue)' : 'transparent',
                  color: timeRange === opt.value ? 'white' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: timeRange === opt.value ? 600 : 400,
                  textAlign: 'center',
                  border: timeRange === opt.value ? 'none' : '1px solid var(--border-color)'
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
