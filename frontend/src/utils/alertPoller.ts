import { api } from '@/api/client'
import { sendUrgentAlert } from './alertNotifier'

/**
 * 告警轮询服务
 * 定期检查新告警并触发通知
 */

let pollTimer: NodeJS.Timeout | null = null
let lastCheckTime = Date.now()
const seenAlertIds = new Set<number>()

// 开始轮询告警
export function startAlertPolling(intervalMs = 30000) {
  // 停止已有的轮询
  stopAlertPolling()

  console.log('[AlertPoller] Starting alert polling, interval:', intervalMs)

  // 立即检查一次
  checkNewAlerts()

  // 定期轮询
  pollTimer = setInterval(() => {
    checkNewAlerts()
  }, intervalMs)
}

// 停止轮询
export function stopAlertPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
    console.log('[AlertPoller] Stopped alert polling')
  }
}

// 检查新告警
async function checkNewAlerts() {
  try {
    // 获取最近的告警（最近1小时）
    const alerts = await api.get('/alerts', {
      params: {
        start: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        limit: 50
      }
    })

    if (!Array.isArray(alerts)) return

    // 过滤出新的紧急/警告级别告警
    const newUrgentAlerts = alerts.filter((alert: any) => {
      // 只处理未见过的告警
      if (seenAlertIds.has(alert.id)) return false

      // 只处理紧急和警告级别
      const severity = alert.severity?.toLowerCase() || ''
      if (!['critical', 'warning'].includes(severity)) return false

      // 只处理激活状态的告警
      if (alert.state !== 'firing' && alert.state !== 'pending') return false

      // 标记为已见
      seenAlertIds.add(alert.id)

      return true
    })

    // 发送通知
    for (const alert of newUrgentAlerts) {
      console.log('[AlertPoller] New urgent alert:', alert)

      await sendUrgentAlert({
        id: alert.id,
        title: alert.name || alert.alertname || '未知告警',
        message: alert.summary || alert.description || alert.message || '无详细信息',
        severity: alert.severity?.toLowerCase() === 'critical' ? 'critical' : 'warning',
        source: alert.cluster_name || alert.instance || alert.job || undefined
      })
    }

    // 清理旧的已见ID（保留最近1000个）
    if (seenAlertIds.size > 1000) {
      const arr = Array.from(seenAlertIds)
      seenAlertIds.clear()
      arr.slice(-500).forEach(id => seenAlertIds.add(id))
    }

    lastCheckTime = Date.now()
  } catch (err) {
    console.error('[AlertPoller] Failed to check alerts:', err)
  }
}

// 重置已见告警（用于手动刷新）
export function resetSeenAlerts() {
  seenAlertIds.clear()
  console.log('[AlertPoller] Reset seen alerts')
}

// 获取轮询状态
export function getPollingStatus() {
  return {
    isRunning: pollTimer !== null,
    lastCheckTime,
    seenCount: seenAlertIds.size
  }
}
