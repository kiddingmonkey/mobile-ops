import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import FloatingAlert from './floatingAlert'

/**
 * 告警通知服务
 * 支持本地通知、震动、声音提醒、语音播报、悬浮窗
 */

let notificationPermission = false
let ttsEnabled = true // TTS功能开关
let floatingAlertEnabled = true // 悬浮窗开关

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

  // 语音播报（仅critical级别）
  if (alert.severity === 'critical' && ttsEnabled) {
    try {
      const spokenText = `紧急告警：${alert.title}。${alert.message}`
      await TextToSpeech.speak({
        text: spokenText,
        lang: 'zh-CN',
        rate: 1.0,
        pitch: 1.2,
        volume: 1.0,
        category: 'ambient'
      })
    } catch (e) {
      console.error('[AlertNotifier] TTS failed:', e)
    }
  }

  // 悬浮窗（critical级别，覆盖其他应用）
  if (alert.severity === 'critical' && floatingAlertEnabled && Capacitor.isNativePlatform()) {
    try {
      const permission = await FloatingAlert.checkPermission()
      if (permission.granted) {
        await FloatingAlert.showAlert({
          title: alert.title,
          message: alert.message,
          severity: alert.severity
        })
      }
    } catch (e) {
      console.error('[AlertNotifier] Floating alert failed:', e)
    }
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

// 设置TTS开关
export function setTTSEnabled(enabled: boolean) {
  ttsEnabled = enabled
  localStorage.setItem('alert_tts_enabled', enabled ? '1' : '0')
}

// 获取TTS开关状态
export function getTTSEnabled(): boolean {
  const saved = localStorage.getItem('alert_tts_enabled')
  if (saved !== null) {
    ttsEnabled = saved === '1'
  }
  return ttsEnabled
}

// 测试语音播报
export async function testTTS(text = '这是一条测试告警') {
  try {
    await TextToSpeech.speak({
      text,
      lang: 'zh-CN',
      rate: 1.0,
      pitch: 1.2,
      volume: 1.0,
      category: 'ambient'
    })
    return true
  } catch (e) {
    console.error('[AlertNotifier] TTS test failed:', e)
    return false
  }
}

// 设置悬浮窗开关
export function setFloatingAlertEnabled(enabled: boolean) {
  floatingAlertEnabled = enabled
  localStorage.setItem('alert_floating_enabled', enabled ? '1' : '0')
}

// 获取悬浮窗开关状态
export function getFloatingAlertEnabled(): boolean {
  const saved = localStorage.getItem('alert_floating_enabled')
  if (saved !== null) {
    floatingAlertEnabled = saved === '1'
  }
  return floatingAlertEnabled
}

// 请求悬浮窗权限
export async function requestFloatingPermission() {
  if (!Capacitor.isNativePlatform()) return false

  try {
    const result = await FloatingAlert.checkPermission()
    if (result.granted) return true

    await FloatingAlert.requestPermission()
    // 用户需要在设置页手动授权，这里返回到设置页
    return false
  } catch (e) {
    console.error('[AlertNotifier] Failed to request floating permission:', e)
    return false
  }
}
