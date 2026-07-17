# APK自动更新配置指南

## 前提条件

1. **腾讯云COS存储桶**：
   - 已创建COS存储桶
   - 开启公共读取权限（或配置CDN加速）
   - 记录存储桶名称和地域

2. **GitHub Secrets配置**：
   在仓库的 Settings → Secrets and variables → Actions 中添加以下密钥：

   | 密钥名称 | 说明 | 示例 |
   |---------|------|------|
   | `COS_SECRET_ID` | 腾讯云API密钥ID | `AKIDxxxxxxxxxxxxxx` |
   | `COS_SECRET_KEY` | 腾讯云API密钥Key | `xxxxxxxxxxxxxxxx` |
   | `COS_BUCKET` | COS存储桶名称 | `cloudpilot-1234567890` |
   | `COS_REGION` | COS存储桶地域 | `ap-guangzhou` |

## 工作流程

### 1. 构建APK
```
GitHub Actions编译APK
↓
保存为artifact
```

### 2. 自动上传到COS
```
下载artifact
↓
上传到COS: releases/cloudpilot-v1.1.0.apk
↓
上传到COS: releases/cloudpilot-latest.apk (始终指向最新版本)
↓
生成latest.json (版本信息)
↓
上传到COS: releases/latest.json
```

### 3. App检查更新
```
App启动5秒后
↓
请求 /api/v1/version/latest
↓
后端从COS获取 releases/latest.json
↓
对比版本号
↓
有新版本 → 提示用户更新
↓
用户点击"立即更新"
↓
从COS下载APK
↓
自动安装
```

## COS存储结构

```
your-bucket/
├── releases/
│   ├── latest.json                      # 最新版本信息
│   ├── cloudpilot-latest.apk            # 最新版本APK（符号链接）
│   ├── cloudpilot-v1.0.0.apk            # 历史版本
│   ├── cloudpilot-v1.1.0.apk            # 历史版本
│   └── cloudpilot-v1.2.0.apk            # 最新版本
```

## latest.json 格式

```json
{
  "version": "1.2.0",
  "build": "abc123de",
  "download_url": "https://cloudpilot-xxx.cos.ap-guangzhou.myqcloud.com/releases/cloudpilot-latest.apk",
  "changelog": "更新内容...",
  "required": false,
  "file_size": 52428800,
  "published_at": "2024-01-20T10:00:00Z"
}
```

## 手动上传到COS

如果不使用GitHub Actions，可以手动上传：

### 1. 安装COS CLI
```bash
wget https://github.com/tencentyun/coscli/releases/download/v0.13.0-beta/coscli-linux
chmod +x coscli-linux
```

### 2. 配置COS
```bash
./coscli-linux config set \
  -e cos.ap-guangzhou.myqcloud.com \
  -i YOUR_SECRET_ID \
  -k YOUR_SECRET_KEY \
  -b your-bucket-name
```

### 3. 上传APK
```bash
./coscli-linux cp app-release.apk cos://releases/cloudpilot-v1.1.0.apk
./coscli-linux cp app-release.apk cos://releases/cloudpilot-latest.apk
```

### 4. 上传版本信息
```bash
cat > latest.json << EOF
{
  "version": "1.1.0",
  "build": "12c2c89",
  "download_url": "https://your-bucket.cos.ap-guangzhou.myqcloud.com/releases/cloudpilot-latest.apk",
  "changelog": "更新内容",
  "required": false,
  "file_size": 52428800,
  "published_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

./coscli-linux cp latest.json cos://releases/latest.json
```

## 后端配置

如果COS URL不是默认的，需要设置环境变量：

```bash
export COS_VERSION_URL=https://your-custom-domain.com/releases/latest.json
```

或在config.yaml中添加：
```yaml
cos:
  version_url: https://your-custom-domain.com/releases/latest.json
```

## CDN加速（可选）

为了提升国内访问速度，建议配置CDN：

1. 在腾讯云CDN控制台添加加速域名
2. 源站类型选择"对象存储COS"
3. 配置HTTPS证书
4. 将`download_url`改为CDN域名

## 测试更新功能

### 1. 修改当前版本号
在`frontend/package.json`中临时改为较低版本：
```json
{
  "version": "1.0.0"
}
```

### 2. 上传测试版本到COS
确保COS中有`releases/latest.json`，且版本号较高（如1.1.0）

### 3. 重新编译APK
```bash
cd frontend
npm run build
npx cap sync android
cd ..
./scripts/build_android_apk.sh
```

### 4. 安装并测试
- 安装APK
- 打开App
- 等待5秒
- 应该弹出更新提示

## 故障排查

### 问题1：未检测到更新
- 检查`/api/v1/version/latest`是否返回正确数据
- 检查COS中`latest.json`是否存在
- 检查版本号比较逻辑

### 问题2：下载失败
- 检查COS存储桶是否公开读取
- 检查`download_url`是否可访问
- 检查网络连接

### 问题3：安装失败
- 检查是否允许"安装未知来源"
- 检查APK文件是否完整
- 检查Android版本兼容性

## 安全注意事项

1. **COS存储桶权限**：
   - 只开启公共读取权限
   - 不要开启公共写入权限

2. **密钥安全**：
   - 使用子账号密钥，限制权限范围
   - 定期轮换密钥
   - 不要在代码中硬编码密钥

3. **APK签名**：
   - 确保APK使用正确的签名证书
   - 不要泄露签名密钥

## 成本估算

腾讯云COS费用：
- 存储费用：约0.1元/GB/月
- 流量费用：约0.5元/GB（国内下载）
- 请求费用：约0.01元/万次

假设：
- APK大小：50MB
- 月下载量：1000次
- 月成本：约25元
