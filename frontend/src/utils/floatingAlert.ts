import { registerPlugin } from '@capacitor/core'

export interface FloatingAlertPlugin {
  checkPermission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted?: boolean }>
  showAlert(options: {
    title: string
    message: string
    severity: 'critical' | 'warning' | 'info'
  }): Promise<void>
  dismissAlert(): Promise<void>
}

const FloatingAlert = registerPlugin<FloatingAlertPlugin>('FloatingAlert', {
  web: () => {
    // Web端降级实现（空操作）
    return {
      checkPermission: async () => ({ granted: false }),
      requestPermission: async () => ({ granted: false }),
      showAlert: async () => {},
      dismissAlert: async () => {}
    }
  }
})

export default FloatingAlert
