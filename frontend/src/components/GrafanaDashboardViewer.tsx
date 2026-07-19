import React, { useState, useEffect, useMemo } from 'react'
import { Collapse, Button, List, Popup, Skeleton } from 'antd-mobile'
import { RightOutline } from 'antd-mobile-icons'
import axios from 'axios'

interface PanelInfo {
  id: number
  title: string
  type: string
  gridPos: { x: number; y: number; w: number; h: number }
}

interface RowInfo {
  title: string
  collapsed: boolean
  panels: PanelInfo[]
}

interface DashboardStructure {
  title: string
  uid: string
  rows: RowInfo[]
  standalonePanels: PanelInfo[]
}

interface Props {
  /** 原始 Grafana URL */
  originalUrl: string
  /** Grafana API Token */
  apiToken?: string
  /** 是否显示全部面板（false=仅关键指标） */
  showAll?: boolean
}

/**
 * 智能 Grafana Dashboard 查看器
 * - 自动检测大型 dashboard（> 20 面板）
 * - 按 row 分组折叠展示
 * - 关键指标优先置顶
 * - 单面板可全屏查看
 */
const GrafanaDashboardViewer: React.FC<Props> = ({
  originalUrl,
  apiToken,
  showAll = false
}) => {
  const [structure, setStructure] = useState<DashboardStructure | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedRows, setExpandedRows] = useState<string[]>([])
  const [fullscreenPanel, setFullscreenPanel] = useState<PanelInfo | null>(null)

  // 从 URL 提取 Grafana 基础信息
  const grafanaInfo = useMemo(() => {
    const urlMatch = originalUrl.match(/^(https?:\/\/[^\/]+).*\/d\/([^\/]+)/)
    if (!urlMatch) return null
    return {
      baseUrl: urlMatch[1],
      uid: urlMatch[2]
    }
  }, [originalUrl])

  // 加载 dashboard 结构
  useEffect(() => {
    if (!grafanaInfo) {
      setError('无效的 Grafana URL')
      setLoading(false)
      return
    }

    const fetchDashboard = async () => {
      try {
        const headers: Record<string, string> = {}
        if (apiToken) {
          headers.Authorization = `Bearer ${apiToken}`
        }

        const resp = await axios.get(
          `${grafanaInfo.baseUrl}/api/dashboards/uid/${grafanaInfo.uid}`,
          { headers }
        )

        const dashboard = resp.data.dashboard
        const panels = dashboard.panels || []

        // 解析 row 和独立面板
        const rows: RowInfo[] = []
        const standalone: PanelInfo[] = []

        panels.forEach((p: any) => {
          if (p.type === 'row') {
            rows.push({
              title: p.title || '未命名分组',
              collapsed: p.collapsed || false,
              panels: p.collapsed && p.panels ? p.panels : []
            })
          } else if (p.type !== 'row') {
            // 独立面板（不在折叠 row 里）
            standalone.push({
              id: p.id,
              title: p.title || '未命名面板',
              type: p.type,
              gridPos: p.gridPos || { x: 0, y: 0, w: 24, h: 8 }
            })
          }
        })

        setStructure({
          title: dashboard.title,
          uid: grafanaInfo.uid,
          rows,
          standalonePanels: standalone
        })

        // 默认展开第一个 row（通常是核心指标）
        if (rows.length > 0) {
          setExpandedRows([rows[0].title])
        }
      } catch (err: any) {
        setError(err.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [grafanaInfo, apiToken])

  // 生成面板嵌入 URL
  const getPanelEmbedUrl = (panelId: number) => {
    if (!grafanaInfo) return ''
    return `${grafanaInfo.baseUrl}/d-solo/${grafanaInfo.uid}?orgId=1&panelId=${panelId}&theme=dark`
  }

  // 总面板数
  const totalPanels = useMemo(() => {
    if (!structure) return 0
    const rowPanels = structure.rows.reduce((sum, r) => sum + r.panels.length, 0)
    return rowPanels + structure.standalonePanels.length
  }, [structure])

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton.Title animated />
        <Skeleton.Paragraph lineCount={5} animated />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>
        ⚠️ {error}
      </div>
    )
  }

  if (!structure) return null

  // 大型 dashboard（> 20 面板）使用折叠展示
  const isLargeDashboard = totalPanels > 20

  return (
    <div style={{ background: 'var(--bg-primary)' }}>
      {/* 头部信息 */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          {structure.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {totalPanels} 个面板
          {isLargeDashboard && ' · 大型 Dashboard'}
        </div>
      </div>

      {/* 大型 dashboard：折叠分组展示 */}
      {isLargeDashboard ? (
        <div style={{ padding: '8px 0' }}>
          {structure.rows.map((row, idx) => (
            <Collapse
              key={idx}
              activeKey={expandedRows}
              onChange={(keys) => setExpandedRows(keys as string[])}
              accordion={false}
            >
              <Collapse.Panel
                key={row.title}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{row.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {row.panels.length} 个面板
                    </span>
                  </div>
                }
              >
                <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
                  {row.panels.map((panel) => (
                    <List.Item
                      key={panel.id}
                      arrow={<RightOutline />}
                      onClick={() => setFullscreenPanel(panel)}
                      description={`类型: ${panel.type}`}
                    >
                      {panel.title}
                    </List.Item>
                  ))}
                </List>
              </Collapse.Panel>
            </Collapse>
          ))}

          {/* 独立面板（不在 row 里的） */}
          {structure.standalonePanels.length > 0 && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                其他面板
              </div>
              <List>
                {structure.standalonePanels.map((panel) => (
                  <List.Item
                    key={panel.id}
                    arrow={<RightOutline />}
                    onClick={() => setFullscreenPanel(panel)}
                    description={`类型: ${panel.type}`}
                  >
                    {panel.title}
                  </List.Item>
                ))}
              </List>
            </div>
          )}
        </div>
      ) : (
        // 小型 dashboard：直接嵌入显示
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {structure.standalonePanels.map((panel) => (
            <div key={panel.id} style={{
              background: 'var(--bg-elevated)',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{panel.title}</div>
              </div>
              <iframe
                src={getPanelEmbedUrl(panel.id)}
                style={{ width: '100%', height: 300, border: 'none' }}
                title={panel.title}
              />
            </div>
          ))}
        </div>
      )}

      {/* 全屏查看单个面板 */}
      {fullscreenPanel && (
        <Popup
          visible={true}
          onMaskClick={() => setFullscreenPanel(null)}
          bodyStyle={{ height: '80vh', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{fullscreenPanel.title}</div>
              <Button size="small" onClick={() => setFullscreenPanel(null)}>关闭</Button>
            </div>
            <iframe
              src={getPanelEmbedUrl(fullscreenPanel.id)}
              style={{ flex: 1, border: 'none', width: '100%' }}
              title={fullscreenPanel.title}
            />
          </div>
        </Popup>
      )}
    </div>
  )
}

export default GrafanaDashboardViewer
