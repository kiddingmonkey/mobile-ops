import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mobileops.app',
  appName: 'CloudPilot',
  webDir: 'dist',
  // 不配 server.url：APK 加载本地打包的 dist，即使后端 500 / 网络不通也能进登录页
  // API 请求走绝对 URL (VITE_API_BASE)，请求失败在页面里以错误提示展示
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // 禁用系统返回手势避免误触退出App
    overrideUserAgent: undefined,
    backgroundColor: '#ffffff'
  },
  ios: {
    // 禁用iOS侧滑返回手势
    scrollEnabled: true,
    allowsBackForwardNavigationGestures: false,
    // 支持所有方向（Holodeck 需要横屏，其他主题竖屏）
    contentInset: 'always'
  }
};

export default config;
