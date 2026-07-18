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
 * 快捷分享告警卡片
 */
export async function shareAlertCard(data: AlertShareData): Promise<boolean> {
  return shareText(formatAlertCard(data), `告警: ${data.alertname}`)
}

/**
 * 快捷分享日志卡片
 */
export async function shareLogCard(data: LogShareData): Promise<boolean> {
  return shareText(formatLogCard(data), `${data.pod} 日志`)
}
