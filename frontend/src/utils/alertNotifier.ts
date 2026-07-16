import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

/**
 * 告警通知服务
 * 支持本地通知、震动、声音提醒
 */

let notificationPermission = false

// 初始化通知权限
export async function initNotifications() {
  if (!Capacitor.isNativePlatform()) return false

  try {
    const result = await LocalNotifications.checkPermissions()
    if (result.display === 'granted') {
      notificationPermission = true
      return true
    }

    // 请求权限
    const request = await LocalNotifications.requestPermissions()
    notificationPermission = request.display === 'granted'
    return notificationPermission
  } catch (e) {
    console.error('[AlertNotifier] Failed to init notifications:', e)
    return false
  }
}

// 发送紧急告警通知
export async function sendUrgentAlert(alert: {
  id: number
  title: string
  message: string
  severity: 'critical' | 'warning' | 'info'
  source?: string
}) {
  if (!Capacitor.isNativePlatform()) {
    // 浏览器环境：使用浏览器通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(alert.title, {
        body: alert.message,
        icon: '/icon-192.png',
        tag: `alert-${alert.id}`,
        requireInteraction: alert.severity === 'critical'
      })
    }
    return
  }

  // 检查权限
  if (!notificationPermission) {
    const granted = await initNotifications()
    if (!granted) return
  }

  // 震动模式
  if (alert.severity === 'critical') {
    try {
      // 紧急告警：强烈震动
      await Haptics.vibrate({ duration: 1000 })
      setTimeout(() => Haptics.vibrate({ duration: 500 }), 1200)
      setTimeout(() => Haptics.vibrate({ duration: 500 }), 2000)
    } catch (e) {
      console.error('[AlertNotifier] Vibration failed:', e)
    }
  } else if (alert.severity === 'warning') {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy })
    } catch (e) {
      console.error('[AlertNotifier] Haptic failed:', e)
    }
  }

  // 发送本地通知
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: alert.id,
          title: `🚨 ${alert.severity === 'critical' ? '紧急' : ''}告警`,
          body: `${alert.title}\n${alert.message}`,
          largeBody: alert.source ? `来源: ${alert.source}\n\n${alert.message}` : alert.message,
          summaryText: alert.source || '监控告警',
          // 声音和通知渠道
          sound: alert.severity === 'critical' ? 'default' : undefined,
          channelId: alert.severity === 'critical' ? 'urgent-alerts' : 'alerts',
          // 点击后打开App到告警页面
          extra: {
            route: '/alerts',
            alertId: alert.id
          }
        }
      ]
    })
  } catch (e) {
    console.error('[AlertNotifier] Failed to send notification:', e)
  }
}

// 取消告警通知
export async function cancelAlert(alertId: number) {
  if (!Capacitor.isNativePlatform()) return

  try {
    await LocalNotifications.cancel({ notifications: [{ id: alertId }] })
  } catch (e) {
    console.error('[AlertNotifier] Failed to cancel notification:', e)
  }
}

// 清除所有通知
export async function clearAllAlerts() {
  if (!Capacitor.isNativePlatform()) return

  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch (e) {
    console.error('[AlertNotifier] Failed to clear notifications:', e)
  }
}

// 创建通知渠道（Android）
export async function setupNotificationChannels() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return

  try {
    await LocalNotifications.createChannel({
      id: 'urgent-alerts',
      name: '紧急告警',
      description: '关键系统告警，需要立即处理',
      importance: 5,
      sound: 'default',
      vibration: true,
      visibility: 1
    })

    await LocalNotifications.createChannel({
      id: 'alerts',
      name: '普通告警',
      description: '监控告警通知',
      importance: 4,
      sound: 'default',
      vibration: true,
      visibility: 1
    })
  } catch (e) {
    console.error('[AlertNotifier] Failed to create channels:', e)
  }
}
