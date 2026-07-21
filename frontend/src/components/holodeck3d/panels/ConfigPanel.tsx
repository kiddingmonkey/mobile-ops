import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useTheme } from '@/store'
import PanelShell from './PanelShell'

/**
 * 配置面板：主题切换 + 数据源状态 + 设置入口
 */

export default function ConfigPanel({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const themeMode = useTheme(s => s.mode)
  const setThemeMode = useTheme(s => s.setMode)
  const [grafana, setGrafana] = useState<any[]>([])
  const [prom, setProm] = useState<any[]>([])
  const [cloud, setCloud] = useState<any[]>([])
  const [clusters, setClusters] = useState<any[]>([])

  useEffect(() => {
    api.listGrafana().then(g => setGrafana(g || [])).catch(() => {})
    api.listProm().then(p => setProm(p || [])).catch(() => {})
    api.listCloudAccounts().then(c => setCloud(c || [])).catch(() => {})
    api.listClusters().then(cs => setClusters(cs || [])).catch(() => {})
  }, [])

  const themes = [
    { value: 'dark', label: '深色', icon: '🌙' },
    { value: 'light', label: '浅色', icon: '☀️' },
    { value: 'pure-black', label: '纯黑', icon: '⚫' },
    { value: 'guofeng', label: '国风', icon: '🏮' },
    { value: 'holodeck', label: '全息', icon: '✨' },
    { value: 'auto', label: '跟随系统', icon: '🔄' },
  ]

  return (
    <PanelShell title="系统配置" titleEn="CONFIG" color="#00e5ff" onClose={onClose}>
      <div style={{ padding: 12 }}>
        {/* 主题切换 */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.25em',
          color: '#00e5ff',
          marginBottom: 8,
          textShadow: '0 0 6px #00e5ff',
        }}>
          ◇ THEME · 主题
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          marginBottom: 16,
        }}>
          {themes.map(t => {
            const active = themeMode === t.value
            return (
              <button
                key={t.value}
                onClick={() => setThemeMode(t.value as any)}
                style={{
                  background: active ? 'rgba(0,229,255,0.15)' : 'rgba(10,20,45,0.5)',
                  border: `1px solid ${active ? '#00e5ff' : 'rgba(120,200,255,0.2)'}`,
                  color: active ? '#00e5ff' : 'rgba(220,240,255,0.7)',
                  padding: '8px 6px',
                  fontSize: 10,
                  cursor: 'pointer',
                  borderRadius: 2,
                  fontFamily: 'inherit',
                  letterSpacing: '0.05em',
                  textShadow: active ? '0 0 6px #00e5ff' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* 数据源状态 */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.25em',
          color: '#4fc3f7',
          marginBottom: 8,
          textShadow: '0 0 6px #4fc3f7',
        }}>
          ◇ DATA SOURCES · 数据源
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          <StatusRow label="Grafana" count={grafana.length} color="#ff6b9d" />
          <StatusRow label="Prometheus" count={prom.length} color="#e6522c" />
          <StatusRow label="云账号" count={cloud.length} color="#4fc3f7" />
          <StatusRow label="集群" count={clusters.length} color="#4ade80" />
        </div>

        {/* 快捷入口 */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.25em',
          color: '#a78bfa',
          marginBottom: 8,
          textShadow: '0 0 6px #a78bfa',
        }}>
          ◇ QUICK ACCESS · 快捷入口
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <QuickButton onClick={() => { onClose(); nav('/settings/grafana') }}>
            🎯 Grafana 数据源
          </QuickButton>
          <QuickButton onClick={() => { onClose(); nav('/settings/prom') }}>
            📊 Prometheus 数据源
          </QuickButton>
          <QuickButton onClick={() => { onClose(); nav('/settings/cloud') }}>
            ☁️ 云账号管理
          </QuickButton>
          <QuickButton onClick={() => { onClose(); nav('/settings/clusters') }}>
            🎛️ 集群管理
          </QuickButton>
          <QuickButton onClick={() => { onClose(); nav('/settings/alert-filter') }}>
            🚨 告警策略
          </QuickButton>
          <QuickButton onClick={() => { onClose(); nav('/settings') }}>
            ⚙️ 完整设置 →
          </QuickButton>
        </div>
      </div>
    </PanelShell>
  )
}

function StatusRow({ label, count, color }: { label: string; count: number; color: string }) {
  const connected = count > 0
  return (
    <div style={{
      background: 'rgba(10, 20, 45, 0.5)',
      border: `1px solid ${connected ? color : 'rgba(120,200,255,0.15)'}40`,
      borderLeft: `3px solid ${connected ? color : '#5D7A9A'}`,
      padding: '8px 10px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'rgba(220,240,255,0.9)' }}>{label}</div>
      <div style={{
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        color: connected ? color : '#5D7A9A',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: connected ? color : '#5D7A9A',
          boxShadow: connected ? `0 0 8px ${color}` : 'none',
        }} />
        {count} 个
      </div>
    </div>
  )
}

function QuickButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(10, 20, 45, 0.5)',
        border: '1px solid rgba(120,200,255,0.25)',
        color: 'rgba(220,240,255,0.9)',
        padding: '10px 12px',
        fontSize: 11,
        cursor: 'pointer',
        borderRadius: 2,
        fontFamily: 'inherit',
        textAlign: 'left',
        letterSpacing: '0.05em',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(79,195,247,0.1)'
        e.currentTarget.style.borderColor = '#4fc3f7'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(10,20,45,0.5)'
        e.currentTarget.style.borderColor = 'rgba(120,200,255,0.25)'
      }}
    >
      {children}
    </button>
  )
}
