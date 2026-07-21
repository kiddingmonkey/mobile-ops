import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import PanelShell from './PanelShell'

/**
 * 监控面板：Grafana 仪表板快捷入口 + Prometheus 查询
 */

export default function MonitorPanel({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [grafana, setGrafana] = useState<any[]>([])
  const [prom, setProm] = useState<any[]>([])

  useEffect(() => {
    api.listGrafana().then(g => setGrafana(g || [])).catch(() => {})
    api.listProm().then(p => setProm(p || [])).catch(() => {})
  }, [])

  return (
    <PanelShell title="监控中心" titleEn="MONITOR" color="#4fc3f7" onClose={onClose}>
      <div style={{ padding: 12 }}>
        {/* Grafana 列表 */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.25em',
          color: '#4fc3f7',
          marginBottom: 8,
          textShadow: '0 0 6px #4fc3f7',
        }}>
          ◇ GRAFANA DASHBOARDS · 仪表板 ({grafana.length})
        </div>
        {grafana.length === 0 ? (
          <div style={{
            padding: '30px 20px',
            textAlign: 'center',
            color: 'rgba(220,240,255,0.5)',
            fontSize: 11,
          }}>
            未配置 Grafana 数据源
          </div>
        ) : (
          grafana.map(g => (
            <div
              key={g.id}
              onClick={() => {
                onClose()
                nav('/monitor')
              }}
              style={{
                background: 'rgba(10, 20, 45, 0.5)',
                border: '1px solid rgba(79,195,247,0.3)',
                borderLeft: '3px solid #4fc3f7',
                padding: '10px 12px',
                marginBottom: 6,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(220,240,255,0.95)', marginBottom: 2 }}>
                {g.name || 'Grafana'}
              </div>
              <div style={{
                fontSize: 10,
                color: 'rgba(220,240,255,0.6)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {g.url || 'N/A'}
              </div>
            </div>
          ))
        )}

        {/* Prometheus 列表 */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.25em',
          color: '#fbbf24',
          marginBottom: 8,
          marginTop: 16,
          textShadow: '0 0 6px #fbbf24',
        }}>
          ◇ PROMETHEUS · 查询引擎 ({prom.length})
        </div>
        {prom.length === 0 ? (
          <div style={{
            padding: '30px 20px',
            textAlign: 'center',
            color: 'rgba(220,240,255,0.5)',
            fontSize: 11,
          }}>
            未配置 Prometheus 数据源
          </div>
        ) : (
          prom.map(p => (
            <div
              key={p.id}
              onClick={() => {
                onClose()
                nav('/monitor')
              }}
              style={{
                background: 'rgba(10, 20, 45, 0.5)',
                border: '1px solid rgba(251,191,36,0.3)',
                borderLeft: '3px solid #fbbf24',
                padding: '10px 12px',
                marginBottom: 6,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(220,240,255,0.95)', marginBottom: 2 }}>
                {p.name || 'Prometheus'}
              </div>
              <div style={{
                fontSize: 10,
                color: 'rgba(220,240,255,0.6)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {p.url || 'N/A'}
              </div>
            </div>
          ))
        )}

        {/* 快捷跳转 */}
        <button
          onClick={() => {
            onClose()
            nav('/monitor')
          }}
          style={{
            width: '100%',
            marginTop: 16,
            background: 'rgba(79,195,247,0.15)',
            border: '1px solid #4fc3f7',
            color: '#4fc3f7',
            padding: '10px',
            fontSize: 11,
            letterSpacing: '0.2em',
            cursor: 'pointer',
            borderRadius: 2,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          打开监控全屏视图 →
        </button>

        <div style={{
          marginTop: 16,
          padding: '12px',
          background: 'rgba(79,195,247,0.05)',
          border: '1px solid rgba(79,195,247,0.2)',
          borderRadius: 4,
          fontSize: 11,
          color: 'rgba(220,240,255,0.7)',
          lineHeight: 1.6,
        }}>
          💡 提示：点击任一数据源可跳转到全屏监控页面，查看完整仪表板和执行 PromQL 查询
        </div>
      </div>
    </PanelShell>
  )
}
