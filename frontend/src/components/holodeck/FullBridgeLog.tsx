import { useEffect, useMemo, useState } from 'react'
import { fmtRelative } from '@/utils/format'

interface Event {
  id: string
  time: number
  level: 'info' | 'warn' | 'error' | 'success'
  text: string
}

const TICKER_LOG_KEY = 'holodeck_ticker_log_v1'

const LEVEL_COLOR: Record<Event['level'], string> = {
  info: 'var(--hd-cyan)',
  warn: 'var(--warning)',
  error: 'var(--hd-emergency)',
  success: 'var(--success)',
}

const LEVEL_LABEL: Record<Event['level'], string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'CRIT',
  success: 'OK',
}

const LEVEL_ICON: Record<Event['level'], string> = {
  info: '◆',
  warn: '▲',
  error: '●',
  success: '✓',
}

function loadAllLogs(): Event[] {
  try {
    return JSON.parse(localStorage.getItem(TICKER_LOG_KEY) || '[]')
  } catch {
    return []
  }
}

type Filter = 'all' | Event['level']

export default function FullBridgeLog({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<Event[]>(() => loadAllLogs())
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    const handler = () => setLogs(loadAllLogs())
    window.addEventListener('holodeck-ticker-update', handler)
    return () => window.removeEventListener('holodeck-ticker-update', handler)
  }, [])

  const counts = useMemo(() => {
    const c = { info: 0, warn: 0, error: 0, success: 0 }
    logs.forEach(e => { c[e.level] += 1 })
    return c
  }, [logs])

  const filtered = filter === 'all' ? logs : logs.filter(e => e.level === filter)

  const clearAll = () => {
    if (!confirm('清空所有航行日志？')) return
    localStorage.removeItem(TICKER_LOG_KEY)
    window.dispatchEvent(new CustomEvent('holodeck-ticker-update'))
    setLogs([])
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
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="hd-panel"
        style={{
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="hd-panel-header">
          <span>◆ BRIDGE LOG · 航行日志</span>
          <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="hd-text-mono" style={{ fontSize: 10, opacity: 0.8 }}>
              {logs.length} · {counts.error}C {counts.warn}W {counts.success}S
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

        {/* 过滤器 */}
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(120, 200, 255, 0.15)',
          flexShrink: 0,
          alignItems: 'center',
        }}>
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
            ALL · {logs.length}
          </FilterBtn>
          <FilterBtn active={filter === 'error'} onClick={() => setFilter('error')} color="var(--hd-emergency)">
            CRIT · {counts.error}
          </FilterBtn>
          <FilterBtn active={filter === 'warn'} onClick={() => setFilter('warn')} color="var(--warning)">
            WARN · {counts.warn}
          </FilterBtn>
          <FilterBtn active={filter === 'success'} onClick={() => setFilter('success')} color="var(--success)">
            OK · {counts.success}
          </FilterBtn>
          <FilterBtn active={filter === 'info'} onClick={() => setFilter('info')} color="var(--hd-cyan)">
            INFO · {counts.info}
          </FilterBtn>
          <div style={{ flex: 1 }} />
          <button
            onClick={clearAll}
            className="hd-btn danger"
            style={{ fontSize: 9, padding: '4px 10px' }}
            disabled={logs.length === 0}
          >
            CLEAR
          </button>
        </div>

        {/* 日志列表 */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '8px 16px 16px',
        }}>
          {filtered.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 12px',
              color: 'var(--text-tertiary)',
            }}>
              <div className="hd-text-mono hd-text-glow" style={{
                fontSize: 12,
                letterSpacing: '0.3em',
                marginBottom: 8,
              }}>
                ◇ NO EVENTS
              </div>
              <div style={{ fontSize: 12 }}>
                {filter === 'all' ? '暂无航行日志记录' : `无 ${LEVEL_LABEL[filter as Event['level']]} 级事件`}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(e => {
                const color = LEVEL_COLOR[e.level]
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '46px 80px 1fr 120px',
                      gap: 12,
                      padding: '8px 12px',
                      background: 'rgba(10, 20, 45, 0.4)',
                      border: '1px solid rgba(120, 200, 255, 0.1)',
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 2,
                      alignItems: 'center',
                    }}
                  >
                    <span className="hd-text-mono" style={{
                      fontSize: 12,
                      color,
                      letterSpacing: '0.1em',
                      textShadow: `0 0 4px ${color}66`,
                    }}>
                      {LEVEL_ICON[e.level]} {LEVEL_LABEL[e.level]}
                    </span>
                    <span className="hd-text-mono" style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      letterSpacing: '0.1em',
                    }}>
                      {fmtRelative(new Date(e.time).toISOString())}
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontFamily: "'JetBrains Mono', monospace",
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {e.text}
                    </span>
                    <span className="hd-text-mono" style={{
                      fontSize: 9,
                      color: 'var(--text-tertiary)',
                      textAlign: 'right',
                    }}>
                      {new Date(e.time).toLocaleTimeString()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterBtn({
  children,
  active,
  color = 'var(--hd-cyan)',
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="hd-text-mono"
      style={{
        background: active ? `${color}22` : 'transparent',
        border: `1px solid ${active ? color : 'rgba(120, 200, 255, 0.2)'}`,
        color: active ? color : 'var(--text-tertiary)',
        padding: '4px 10px',
        fontSize: 10,
        letterSpacing: '0.15em',
        cursor: 'pointer',
        borderRadius: 2,
        fontFamily: 'inherit',
        textShadow: active ? `0 0 6px ${color}66` : 'none',
      }}
    >
      {children}
    </button>
  )
}
