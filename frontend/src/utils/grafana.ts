/**
 * 从 Grafana URL 中提取信息
 */
export function parseGrafanaUrl(url: string) {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')

    // 提取 dashboard UID：/d/{uid}/{slug}
    const dashboardUid = pathParts[2] || ''

    // 提取 panel ID（如果有）
    const panelId = urlObj.searchParams.get('viewPanel') || urlObj.searchParams.get('panelId')

    // 提取 orgId
    const orgId = urlObj.searchParams.get('orgId')

    // 提取时间范围
    const from = urlObj.searchParams.get('from') || 'now-1h'
    const to = urlObj.searchParams.get('to') || 'now'

    return {
      dashboardUid,
      panelId: panelId ? parseInt(panelId) : undefined,
      orgId,
      from,
      to,
      isValid: !!dashboardUid
    }
  } catch (err) {
    console.error('解析 Grafana URL 失败:', err)
    return {
      dashboardUid: '',
      panelId: undefined,
      orgId: null,
      from: 'now-1h',
      to: 'now',
      isValid: false
    }
  }
}

/**
 * 将 Grafana URL 转换为后端代理 URL
 * 用于解决 Mixed Content 问题
 */
export function convertToProxyUrl(originalUrl: string, clusterId: number, timeRange: string): string {
  try {
    const urlObj = new URL(originalUrl)

    // 提取路径（/d/xxx/...）和查询参数
    const path = urlObj.pathname
    const params = new URLSearchParams(urlObj.search)

    // 添加时间范围和 kiosk 模式
    params.set('from', timeRange)
    params.set('to', 'now')
    params.set('kiosk', '')

    // 构建代理 URL
    return `/api/v1/clusters/${clusterId}/grafana/proxy${path}?${params.toString()}`
  } catch (err) {
    console.error('转换代理 URL 失败:', err)
    return originalUrl
  }
}
