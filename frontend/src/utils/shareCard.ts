import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Toast } from 'antd-mobile'

/**
 * 团队分享工具 - 生成运维卡片文本，方便钉钉/飞书/微信转发
 */

interface PodShareData {
  cluster: string
  namespace: string
  name: string
  status: string
  restarts?: number
  image?: string
  node?: string
  age?: string
}

interface AlertShareData {
  alertname: string
  severity: string
  cluster?: string
  namespace?: string
  pod?: string
  summary?: string
  starts_at?: string
}

interface LogShareData {
  cluster: string
  pod: string
  container?: string
  logs: string
  maxLines?: number
}

/**
 * 生成 Pod 分享文本
 */
export function formatPodCard(data: PodShareData): string {
  return [
    `📦 【Pod 详情】`,
    `━━━━━━━━━━━━━━━`,
    `集群: ${data.cluster}`,
    `命名空间: ${data.namespace}`,
    `Pod: ${data.name}`,
    `状态: ${data.status}`,
    data.restarts !== undefined ? `重启次数: ${data.restarts}` : '',
    data.image ? `镜像: ${data.image}` : '',
    data.node ? `节点: ${data.node}` : '',
    data.age ? `运行: ${data.age}` : '',
    `━━━━━━━━━━━━━━━`,
    `来自 CloudPilot 云驾 · ${new Date().toLocaleString('zh-CN')}`
  ].filter(Boolean).join('\n')
}

/**
 * 生成告警分享文本
 */
export function formatAlertCard(data: AlertShareData): string {
  const emoji = data.severity === 'critical' ? '🔴' : data.severity === 'warning' ? '🟡' : '🔵'
  return [
    `${emoji} 【告警】${data.alertname}`,
    `━━━━━━━━━━━━━━━`,
    `级别: ${data.severity.toUpperCase()}`,
    data.cluster ? `集群: ${data.cluster}` : '',
    data.namespace ? `命名空间: ${data.namespace}` : '',
    data.pod ? `Pod: ${data.pod}` : '',
    data.summary ? `\n${data.summary}` : '',
    data.starts_at ? `\n开始: ${new Date(data.starts_at).toLocaleString('zh-CN')}` : '',
    `━━━━━━━━━━━━━━━`,
    `来自 CloudPilot 云驾`
  ].filter(Boolean).join('\n')
}

/**
 * 生成日志片段分享文本
 */
export function formatLogCard(data: LogShareData): string {
  const lines = data.logs.split('\n')
  const maxLines = data.maxLines || 20
  const truncated = lines.length > maxLines
  const content = truncated ? lines.slice(-maxLines).join('\n') : data.logs

  return [
    `📋 【日志片段】`,
    `━━━━━━━━━━━━━━━`,
    `集群: ${data.cluster}`,
    `Pod: ${data.pod}`,
    data.container ? `容器: ${data.container}` : '',
    truncated ? `(最后 ${maxLines} 行，完整日志请到 APP 查看)` : '',
    `━━━━━━━━━━━━━━━`,
    content,
    `━━━━━━━━━━━━━━━`,
    `来自 CloudPilot 云驾 · ${new Date().toLocaleString('zh-CN')}`
  ].filter(Boolean).join('\n')
}

/**
 * 分享文本到系统分享面板（支持钉钉/飞书/微信）
 * 浏览器降级为复制到剪贴板
 */
export async function shareText(text: string, title = 'CloudPilot 云驾'): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title, text, dialogTitle: '分享到...' })
      return true
    }
    // 浏览器: 用 navigator.share 或降级到剪贴板
    if (navigator.share) {
      await navigator.share({ title, text })
      return true
    }
    // 降级: 复制到剪贴板
    await navigator.clipboard.writeText(text)
    Toast.show({ content: '已复制到剪贴板，可粘贴到聊天窗口', icon: 'success', duration: 2000 })
    return true
  } catch (e: any) {
    // 用户主动取消分享不算失败
    if (e.name === 'AbortError' || e.message?.includes('cancel')) {
      return false
    }
    Toast.show({ content: '分享失败: ' + (e.message || ''), icon: 'fail' })
    return false
  }
}

/**
 * 快捷分享 Pod 卡片
 */
export async function sharePodCard(data: PodShareData): Promise<boolean> {
  return shareText(formatPodCard(data), `Pod: ${data.name}`)
}

/**
 * 快捷分享告警卡片（图片 + 文字双重分享）
 */
export async function shareAlertCard(data: AlertShareData): Promise<boolean> {
  const text = formatAlertCard(data)

  // 尝试生成卡片图片
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 400
    const ctx = canvas.getContext('2d')!

    // 背景渐变
    const gradient = ctx.createLinearGradient(0, 0, 0, 400)
    if (data.severity === 'critical') {
      gradient.addColorStop(0, '#1a1a2e')
      gradient.addColorStop(1, '#2d1f3d')
    } else {
      gradient.addColorStop(0, '#1a2332')
      gradient.addColorStop(1, '#1f2d3d')
    }
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 720, 400)

    // 顶部色条
    ctx.fillStyle = data.severity === 'critical' ? '#ef4444' : '#f59e0b'
    ctx.fillRect(0, 0, 720, 6)

    // severity badge
    ctx.fillStyle = data.severity === 'critical' ? '#ef4444' : '#f59e0b'
    ctx.beginPath()
    ctx.roundRect(32, 32, 80, 28, 4)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText(data.severity.toUpperCase(), 44, 51)

    // alertname
    ctx.fillStyle = '#f8fafc'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillText(data.alertname, 32, 100)

    // 分隔线
    ctx.strokeStyle = '#334155'
    ctx.beginPath()
    ctx.moveTo(32, 120)
    ctx.lineTo(688, 120)
    ctx.stroke()

    // 详细信息
    ctx.fillStyle = '#94a3b8'
    ctx.font = '15px sans-serif'
    let y = 152
    if (data.cluster) { ctx.fillText(`集群: ${data.cluster}`, 32, y); y += 30 }
    if (data.namespace) { ctx.fillText(`命名空间: ${data.namespace}`, 32, y); y += 30 }
    if (data.pod) { ctx.fillText(`Pod: ${data.pod}`, 32, y); y += 30 }
    if (data.summary) {
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '14px sans-serif'
      const lines = data.summary.length > 60 ? [data.summary.slice(0, 60), data.summary.slice(60, 120)] : [data.summary]
      lines.forEach(l => { ctx.fillText(l, 32, y); y += 24 })
    }
    if (data.starts_at) {
      ctx.fillStyle = '#64748b'
      ctx.font = '13px sans-serif'
      ctx.fillText(`开始: ${new Date(data.starts_at).toLocaleString('zh-CN')}`, 32, y + 10)
    }

    // 底部 branding
    ctx.fillStyle = '#475569'
    ctx.font = '12px sans-serif'
    ctx.fillText('CloudPilot 云驾 · Mobile SRE', 32, 376)
    ctx.fillText(new Date().toLocaleString('zh-CN'), 520, 376)

    // 转换为 blob 用于分享
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'))
    const file = new File([blob], 'alert-card.png', { type: 'image/png' })

    if (Capacitor.isNativePlatform() || navigator.share) {
      const shareData: any = { title: `告警: ${data.alertname}`, text, files: [file] }
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
        return true
      }
    }
  } catch {
    // 图片生成或分享失败，降级到纯文字
  }

  return shareText(text, `告警: ${data.alertname}`)
}

/**
 * 快捷分享日志卡片
 */
export async function shareLogCard(data: LogShareData): Promise<boolean> {
  return shareText(formatLogCard(data), `${data.pod} 日志`)
}
