import { useEffect, useState, useRef } from 'react'
import { Card, Tag, Toast } from 'antd-mobile'
import { api } from '@/api/client'
import * as echarts from 'echarts'

export default function MetricsTab({ clusterId, namespace, podName, detail }: {
  clusterId: number
  namespace: string
  podName: string
  detail: any
}) {
  const [timeRange, setTimeRange] = useState('1h')
  const [loading, setLoading] = useState(false)
  const [hasData, setHasData] = useState(false)

  const cpuChartRef = useRef<HTMLDivElement>(null)
  const memChartRef = useRef<HTMLDivElement>(null)
  const netChartRef = useRef<HTMLDivElement>(null)
  const diskChartRef = useRef<HTMLDivElement>(null)

  const cpuInstance = useRef<echarts.ECharts | null>(null)
  const memInstance = useRef<echarts.ECharts | null>(null)
  const netInstance = useRef<echarts.ECharts | null>(null)
  const diskInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    loadMetrics()
  }, [clusterId, namespace, podName, timeRange])

  const loadMetrics = async () => {
    setLoading(true)
    try {
      const r = await api.get(`/clusters/${clusterId}/pods/${namespace}/${podName}/metrics`, {
        params: { range: timeRange }
      })

      if (!r || (!r.cpu && !r.memory && !r.network_rx && !r.network_tx && !r.disk_read && !r.disk_write)) {
        setHasData(false)
        Toast.show({ content: '未配置Prometheus或无数据', icon: 'fail' })
        setLoading(false)
        return
      }

      setHasData(true)

      // 确保DOM已渲染再初始化ECharts
      setTimeout(() => {
        // CPU图表
        if (r.cpu && r.cpu.length > 0 && cpuChartRef.current) {
          if (!cpuInstance.current) {
            cpuInstance.current = echarts.init(cpuChartRef.current)
          }
          const cpuData = r.cpu.map((p: any) => [p[0] * 1000, parseFloat(p[1])])
          cpuInstance.current.setOption(getChartOption('CPU 使用率', cpuData, 'cores'))
        }

        // 内存图表
        if (r.memory && r.memory.length > 0 && memChartRef.current) {
          if (!memInstance.current) {
            memInstance.current = echarts.init(memChartRef.current)
          }
          const memData = r.memory.map((p: any) => [p[0] * 1000, parseFloat(p[1]) / 1024 / 1024])
          memInstance.current.setOption(getChartOption('内存使用', memData, 'Mi'))
        }

        // 网络图表（RX + TX）
        if ((r.network_rx || r.network_tx) && netChartRef.current) {
          if (!netInstance.current) {
            netInstance.current = echarts.init(netChartRef.current)
          }
          const series: any[] = []
          if (r.network_rx && r.network_rx.length > 0) {
            series.push({
              name: '接收',
              type: 'line',
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 2 },
              data: r.network_rx.map((p: any) => [p[0] * 1000, parseFloat(p[1]) / 1024]),
              itemStyle: { color: '#3B82F6' }
            })
          }
          if (r.network_tx && r.network_tx.length > 0) {
            series.push({
              name: '发送',
              type: 'line',
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 2 },
              data: r.network_tx.map((p: any) => [p[0] * 1000, parseFloat(p[1]) / 1024]),
              itemStyle: { color: '#10B981' }
            })
          }
          netInstance.current.setOption({
            title: { text: '网络流量 (KB/s)', left: 'center', textStyle: { fontSize: 13, color: '#888' } },
            tooltip: { trigger: 'axis' },
            legend: { bottom: 0, textStyle: { fontSize: 11 } },
            grid: { left: 50, right: 20, top: 40, bottom: 35 },
            xAxis: { type: 'time', axisLabel: { fontSize: 10 } },
            yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
            series
          })
        }

        // 磁盘图表（读 + 写）
        if ((r.disk_read || r.disk_write) && diskChartRef.current) {
          if (!diskInstance.current) {
            diskInstance.current = echarts.init(diskChartRef.current)
          }
          const diskSeries: any[] = []
          if (r.disk_read && r.disk_read.length > 0) {
            diskSeries.push({
              name: '读取',
              type: 'line',
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 2 },
              data: r.disk_read.map((p: any) => [p[0] * 1000, parseFloat(p[1]) / 1024]),
              itemStyle: { color: '#8B5CF6' }
            })
          }
          if (r.disk_write && r.disk_write.length > 0) {
            diskSeries.push({
              name: '写入',
              type: 'line',
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 2 },
              data: r.disk_write.map((p: any) => [p[0] * 1000, parseFloat(p[1]) / 1024]),
              itemStyle: { color: '#F59E0B' }
            })
          }
          diskInstance.current.setOption({
            title: { text: '磁盘 I/O (KB/s)', left: 'center', textStyle: { fontSize: 13, color: '#888' } },
            tooltip: { trigger: 'axis' },
            legend: { bottom: 0, textStyle: { fontSize: 11 } },
            grid: { left: 50, right: 20, top: 40, bottom: 35 },
            xAxis: { type: 'time', axisLabel: { fontSize: 10 } },
            yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
            series: diskSeries
          })
        }
      }, 100)
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '加载失败', icon: 'fail' })
      setHasData(false)
    } finally {
      setLoading(false)
    }
  }

  const getChartOption = (title: string, data: any[], unit: string) => ({
    title: { text: title, left: 'center', textStyle: { fontSize: 13, color: '#888' } },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        return `${new Date(p.value[0]).toLocaleString()}<br/>${p.marker}${p.value[1].toFixed(2)} ${unit}`
      }
    },
    grid: { left: 50, right: 20, top: 40, bottom: 20 },
    xAxis: { type: 'time', axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.2 },
      data,
      itemStyle: { color: '#3B82F6' }
    }]
  })

  return (
    <div style={{ padding: '12px 12px 60px' }}>
      {/* 资源配置 */}
      <Card title="资源配置" style={{ marginBottom: 12 }}>
        {detail.total_requests || detail.total_limits ? (
          <>
            {detail.total_requests && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Requests</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {detail.total_requests.cpu && (
                    <Tag color="primary" style={{ fontSize: 11 }}>CPU: {detail.total_requests.cpu}</Tag>
                  )}
                  {detail.total_requests.memory && (
                    <Tag color="primary" style={{ fontSize: 11 }}>Mem: {detail.total_requests.memory}</Tag>
                  )}
                </div>
              </div>
            )}
            {detail.total_limits && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Limits</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {detail.total_limits.cpu && (
                    <Tag color="warning" style={{ fontSize: 11 }}>CPU: {detail.total_limits.cpu}</Tag>
                  )}
                  {detail.total_limits.memory && (
                    <Tag color="warning" style={{ fontSize: 11 }}>Mem: {detail.total_limits.memory}</Tag>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>未设置资源限制</div>
        )}
      </Card>

      {/* 时间范围 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            { label: '5分钟', value: '5m' },
            { label: '15分钟', value: '15m' },
            { label: '1小时', value: '1h' },
            { label: '6小时', value: '6h' },
            { label: '24小时', value: '24h' }
          ].map(t => (
            <span
              key={t.value}
              onClick={() => setTimeRange(t.value)}
              style={{
                padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                background: timeRange === t.value ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                color: timeRange === t.value ? '#fff' : 'var(--text-primary)',
                borderRadius: 4, border: '1px solid ' + (timeRange === t.value ? 'var(--accent-blue)' : 'var(--border-color)')
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>加载中...</div>
      ) : hasData ? (
        <>
          {/* CPU 图表 */}
          <div style={{ marginBottom: 12 }}>
            <div ref={cpuChartRef} style={{ width: '100%', height: 200 }} />
          </div>

          {/* 内存图表 */}
          <div style={{ marginBottom: 12 }}>
            <div ref={memChartRef} style={{ width: '100%', height: 200 }} />
          </div>

          {/* 网络图表 */}
          <div style={{ marginBottom: 12 }}>
            <div ref={netChartRef} style={{ width: '100%', height: 200 }} />
          </div>

          {/* 磁盘图表 */}
          <div style={{ marginBottom: 12 }}>
            <div ref={diskChartRef} style={{ width: '100%', height: 200 }} />
          </div>
        </>
      ) : (
        <Card>
          <div style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              未配置Prometheus监控
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              请在集群设置中关联Prometheus数据源
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
