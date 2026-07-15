import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mobileops.app',
  appName: 'Mobile-Ops',
  webDir: 'dist',
  server: {
    // App 直接加载远程 URL（这样服务器更新后 App 自动拿到最新，不用重新打包）
    url: 'https://101-43-172-231.nip.io:18443',
    cleartext: false,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true
  }
};

export default config;
