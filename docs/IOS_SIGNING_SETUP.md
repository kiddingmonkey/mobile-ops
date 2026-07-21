# iOS 签名 - GitHub Secrets 配置指南

## 需要配置的 Secrets

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名 | 说明 | 如何获取 |
|-----------|------|---------|
| `IOS_P12_BASE64` | 分发证书 .p12 文件的 Base64 编码 | 见下方步骤 1 |
| `IOS_P12_PASSWORD` | 导出 .p12 时设置的密码 | 你自己设定的 |
| `IOS_TEAM_ID` | Apple Developer Team ID (10位字母数字) | Apple Developer → Membership |
| `IOS_PROVISION_PROFILE_BASE64` | Ad Hoc Provisioning Profile 的 Base64 编码 | 见下方步骤 2 |
| `IOS_PROVISION_PROFILE_NAME` | Profile 的名称（非文件名） | 创建 Profile 时填写的 Name |

## 步骤 1：导出 .p12 证书

```bash
# 在 Mac 上，打开 Keychain Access
# 1. 找到 "Apple Distribution: xxx" 证书
# 2. 右键 → 导出 → 保存为 .p12（设置密码）
# 3. Base64 编码：
base64 -i distribution.p12 | pbcopy
# 粘贴到 IOS_P12_BASE64 Secret
```

如果还没有证书：
1. Apple Developer → Certificates → 创建 "Apple Distribution" 证书
2. 下载 .cer 安装到 Keychain
3. 再从 Keychain 导出 .p12

## 步骤 2：创建 Ad Hoc Provisioning Profile

1. Apple Developer → Profiles → 新建
2. 选择 "Ad Hoc"
3. App ID: `com.mobileops.app`（需先注册）
4. 选择上面的 Distribution 证书
5. 选择测试设备（UDID）
6. 命名保存，下载 .mobileprovision

```bash
# Base64 编码：
base64 -i CloudPilot_AdHoc.mobileprovision | pbcopy
# 粘贴到 IOS_PROVISION_PROFILE_BASE64 Secret
```

## 步骤 3：注册 App ID

1. Apple Developer → Identifiers → 新建
2. Bundle ID: `com.mobileops.app`
3. 勾选需要的 Capabilities（Push Notifications 等）

## 步骤 4：注册测试设备

```bash
# 获取 iPhone/iPad UDID（连接 Mac 后）
# Finder → 设备 → 点击序列号切换显示 UDID
```

1. Apple Developer → Devices → 注册设备 UDID
2. 更新 Provisioning Profile 包含新设备

## 验证

配置完成后，手动触发 workflow：
```bash
gh workflow run build-apps.yml
```

## OTA 热更新说明

iOS 和 Android 共用同一套 OTA 机制：
- 两个平台的 App 内嵌相同的前端代码
- OTA 更新只替换前端 Web 资源（dist.zip）
- 不需要重新提交 App Store / 重新安装
- 用户在 App 内「设置 → 检查更新」即可获取最新版本

这符合 Apple 的政策：Web 资源热更新不需要 App Review。
