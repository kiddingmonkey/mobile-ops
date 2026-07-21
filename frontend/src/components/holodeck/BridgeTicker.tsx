import { useEffect, useMemo, useState } from 'react'
import { fmtRelative } from '@/utils/format'

interface Event {
  id: string
  time: number
  level: 'info' | 'warn' | 'error' | 'success'
  text: string
}

const TICKER_LOG_KEY = 'holodeck_ticker_log_v1'
const MAX_TICKER = 40

/**
 * 从任意地方调用，往舰桥系统日志写一条事件
 */
export function pushBridgeEvent(level: Event['level'], text: string) {
  try {
    const logs: Event[] = JSON.parse(localStorage.getItem(TICKER_LOG_KEY) || '[]')
    logs.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: Date.now(),
      level,
      text,
    })
    if (logs.length > MAX_TICKER) logs.length = MAX_TICKER
    localStorage.setItem(TICKER_LOG_KEY, JSON.stringify(logs))
    window.dispatchEvent(new CustomEvent('holodeck-ticker-update'))
  } catch {}
}

function loadTickerLogs(): Event[] {
  try {
    return JSON.parse(localStorage.getItem(TICKER_LOG_KEY) || '[]')
  } catch {
    return []
  }
}

const LEVEL_COLOR: Record<Event['level'], string> = {
  info: 'var(--hd-cyan)',
  warn: 'var(--warning)',
  error: 'var(--hd-emergency)',
  success: 'var(--success)',
}

const LEVEL_ICON: Record<Event['level'], string> = {
  info: '◆',
  warn: '▲',
  error: '●',
  success: '✓',
}

export default function BridgeTicker({ alerts }: { alerts: any[] }) {
  const [logs, setLogs] = useState<Event[]>(() => loadTickerLogs())

  useEffect(() => {
    const handler = () => setLogs(loadTickerLogs())
    window.addEventListener('holodeck-ticker-update', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('holodeck-ticker-update', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  // 把最新告警合并进日志展示
  const merged = useMemo(() => {
    const alertEvents: Event[] = alerts
      .filter(a => a.status === 'firing')
      .slice(0, 5)
      .map(a => ({
        id: `alert-${a.id}`,
        time: new Date(a.starts_at || a.startsAt || Date.now()).getTime(),
        level: a.severity === 'critical' ? 'error' : 'warn' as Event['level'],
        text: `[${(a.labels?.cluster || 'ALL').toUpperCase()}] ${a.labels?.alertname || a.name || 'Unknown'}`,
      }))
    const all = [...alertEvents, ...logs]
    // 按时间倒序 + 去重
    const seen = new Set<string>()
    return all
      .filter(e => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
      })
      .sort((a, b) => b.time - a.time)
      .slice(0, 12)
  }, [alerts, logs])

  if (merged.length === 0) {
    return (
      <div style={tickerContainerStyle}>
        <div style={tickerLabelStyle}>◆ BRIDGE LOG</div>
        <div style={{
          flex: 1,
          fontSize: 11,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.15em',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          ◇ NO EVENTS · SILENT NIGHT
        </div>
      </div>
    )
  }

  return (
    <div style={tickerContainerStyle}>
      <div style={tickerLabelStyle}>◆ BRIDGE LOG</div>
      <div style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          display: 'flex',
          gap: 24,
          whiteSpace: 'nowrap',
          animation: `hd-ticker-scroll ${Math.max(30, merged.length * 6)}s linear infinite`,
        }}>
          {[...merged, ...merged].map((e, i) => (
            <span
              key={`${e.id}-${i}`}
              style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.05em',
                color: LEVEL_COLOR[e.level],
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ opacity: 0.9 }}>{LEVEL_ICON[e.level]}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>
                [{fmtRelative(new Date(e.time).toISOString())}]
              </span>
              <span>{e.text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

const tickerContainerStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '4px 16px',
  background: 'rgba(3, 5, 16, 0.7)',
  backdropFilter: 'blur(12px)',
  borderTop: '1px solid rgba(120, 200, 255, 0.15)',
  height: 28,
  overflow: 'hidden',
}

const tickerLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.25em',
  color: 'var(--hd-cyan)',
  textShadow: '0 0 6px var(--hd-cyan-glow)',
  fontWeight: 600,
  flexShrink: 0,
  fontFamily: "'JetBrains Mono', monospace",
}
