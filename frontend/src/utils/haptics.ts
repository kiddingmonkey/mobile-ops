import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * 触觉反馈工具 - 统一封装
 *
 * 在原生 APK 里生效，浏览器/PWA 里静默无操作
 * 用于提升重要操作的交互反馈
 */

async function safeCall<T>(fn: () => Promise<T>): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await fn()
  } catch {
    // 静默失败，不影响业务流程
  }
}

// 轻点 - 用于普通按钮、切换 Tab
export const hapticLight = () => safeCall(() => Haptics.impact({ style: ImpactStyle.Light }))

// 中等 - 用于重要按钮、确认操作
export const hapticMedium = () => safeCall(() => Haptics.impact({ style: ImpactStyle.Medium }))

// 重震动 - 用于关键操作（如重启、删除）
export const hapticHeavy = () => safeCall(() => Haptics.impact({ style: ImpactStyle.Heavy }))

// 成功通知 - 用于操作成功后
export const hapticSuccess = () => safeCall(() => Haptics.notification({ type: NotificationType.Success }))

// 警告通知 - 用于警告
export const hapticWarning = () => safeCall(() => Haptics.notification({ type: NotificationType.Warning }))

// 错误通知 - 用于操作失败
export const hapticError = () => safeCall(() => Haptics.notification({ type: NotificationType.Error }))

// 选择变化 - 用于 Selector/Picker 切换
export const hapticSelect = () => safeCall(() => Haptics.selectionChanged())
