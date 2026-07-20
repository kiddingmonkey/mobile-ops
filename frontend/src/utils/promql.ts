// 从 Prometheus/VM generatorURL 提取 PromQL 查询语句
// 例如: http://172.22.67.24:9090/graph?g0.expr=up%3D%3D0&g0.tab=1
export function extractPromQLFromURL(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    // 尝试从 query params 提取 g0.expr 或 expr
    const expr = u.searchParams.get('g0.expr') || u.searchParams.get('expr')
    return expr ? decodeURIComponent(expr) : null
  } catch {
    return null
  }
}

// 格式化 PromQL 查询结果为易读字符串
export function formatPromResult(result: any): string {
  if (!result || !result.data) return '无数据'
  const { data } = result
  if (!data.result || data.result.length === 0) return '查询无结果'

  // 只展示前 5 条结果
  const lines = data.result.slice(0, 5).map((s: any) => {
    const metric = Object.entries(s.metric || {})
      .map(([k, v]) => `${k}="${v}"`)
      .join(', ')
    const value = s.value ? s.value[1] : (s.values && s.values[s.values.length - 1] ? s.values[s.values.length - 1][1] : 'N/A')
    return `{${metric}} = ${value}`
  })

  if (data.result.length > 5) {
    lines.push(`... 还有 ${data.result.length - 5} 条结果`)
  }

  return lines.join('\n')
}
