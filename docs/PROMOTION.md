# CloudPilot 云驾 - 推广方案

## 一、宣传视频制作

### 1.1 录屏工具推荐

**Android**：
- **AZ Screen Recorder**（推荐）
  - 免费无水印
  - 可录内部音频
  - 画质清晰（1080p/60fps）
  - Google Play / APKPure 下载
  
- **小米自带录屏**（MIUI系统）
  - 下拉通知栏 → 屏幕录制
  - 可开启"录制系统声音"

**iOS**：
- **系统自带录屏**
  - 设置 → 控制中心 → 添加"屏幕录制"
  - 从右上角下拉 → 长按录屏按钮 → 开启麦克风
  
- **iOS录制Mac画面**（适合演示+讲解）
  - Mac QuickTime → 文件 → 新建影片录制
  - 选择iPhone作为摄像头和麦克风来源

### 1.2 视频脚本（60秒版）

```
[0-5秒] 开场
  画面：CloudPilot Logo + Slogan
  文案："手机运维神器 CloudPilot 云驾"
  
[5-15秒] 痛点
  画面：工程师在外面/地铁上接到告警电话
  文案："深夜告警，没电脑？外出办事，Pod挂了？"
  
[15-30秒] 核心功能展示
  - 快速切：集群列表 → Pod详情 → 日志滚动
  - 特写：告警震动+TTS语音播报
  - 展示：容器终端执行命令
  - 亮点：深色主题，流畅操作
  
[30-45秒] 高级功能
  - 监控图表：CPU/内存曲线
  - 文件浏览：查看配置文件
  - 云日志：CLS搜索错误日志
  - 安全组：一键加白名单
  
[45-55秒] 安装引导
  画面：二维码 + 安装步骤
  文案："扫码下载 APK，信任证书即可使用"
  
[55-60秒] 结尾
  画面：飞书/微信群二维码
  文案："加入运维交流群，获取最新版本"
```

### 1.3 视频剪辑工具

**手机端**：
- **剪映**（推荐）
  - 操作简单，模板丰富
  - 自动字幕，BGM库
  - 导出无水印（免费）
  
- **快影**
  - 腾讯系，素材多
  - 适合快速出片

**电脑端**（专业）：
- **DaVinci Resolve**（免费）
- **Final Cut Pro**（Mac）
- **Premiere Pro**（Adobe）

### 1.4 视频要点

1. **时长控制**：60-90秒最佳（飞书群可发3分钟以内）
2. **画质**：1080p 竖屏（9:16），适配手机
3. **配乐**：选轻快科技感BGM，音量不要盖过讲解
4. **字幕**：关键功能加字幕说明
5. **转场**：不要花哨，简洁淡入淡出
6. **封面**：选最亮眼的功能截图（监控图表/终端/告警）

---

## 二、多端安装方案

### 2.1 Android 安装

**方式一：直接下载APK**
```
1. 扫码或访问：https://github.com/kiddingmonkey/mobile-ops/releases/latest
2. 下载 cloudpilot-latest.apk
3. 允许"安装未知来源应用"
4. 安装完成
```

**方式二：国内镜像加速**
```
https://ghproxy.com/https://github.com/kiddingmonkey/mobile-ops/releases/latest/download/cloudpilot-latest.apk
```

**证书信任**：
- Android默认允许安装未知来源（在设置里确认一次）
- 如提示"不安全"，选择"仍要安装"
- **关键**：首次打开时Chrome可能提示"该应用由未知开发者提供"，点击"了解详情" → "仍要安装"

### 2.2 iOS 安装（当前）

**限制**：iOS不支持直接安装APK，有3种方案：

**方案A：PWA 模式（推荐，无需安装）**
```
1. Safari 访问：https://101-43-172-231.nip.io:18443/
2. 点击底部"分享"按钮
3. 选择"添加到主屏幕"
4. 完成，桌面出现CloudPilot图标
```
- 优点：无需证书，打开即用
- 缺点：无本地通知，无后台保活

**方案B：TestFlight 公开测试（需开发者账号）**
```
1. 上传 IPA 到 App Store Connect
2. 创建 TestFlight 公开链接
3. 用户点击链接自动安装
```
- 成本：$99/年 Apple Developer
- 适合：正式推广阶段

**方案C：企业签名（贵且有风险）**
```
使用第三方企业证书签名服务
```
- 成本：$300-800/年
- 风险：证书可能被吊销

**当前推荐**：iOS用户直接用PWA（Safari添加到主屏幕），功能95%可用。

### 2.3 iPad 安装

iPad同iOS方案：
- **推荐PWA**：Safari → 添加到主屏幕
- 横屏体验更好（监控图表/日志展示）

### 2.4 电脑（PC/Mac）安装

**方式一：直接访问Web版**
```
Chrome/Edge/Safari 访问：
https://101-43-172-231.nip.io:18443/

或国内IP：
http://10.211.79.100:18443/（内网）
```

**方式二：PWA桌面应用（推荐）**
```
1. Chrome打开上述URL
2. 地址栏右侧出现"安装"图标
3. 点击安装 → 桌面生成独立应用
4. 体验接近原生App
```

- **优点**：
  - 独立窗口，无浏览器地址栏
  - 快捷方式，一键启动
  - 离线缓存（Service Worker）
  - 跨平台（Windows/Mac/Linux通用）

---

## 三、证书信任问题

### 3.1 为什么需要信任证书？

CloudPilot 是**自签名证书**（非CA机构签发），浏览器/系统会警告"不安全"。

### 3.2 Android证书信任

**Chrome浏览器访问时**：
```
1. 看到"您的连接不是私密连接"
2. 点击"高级"
3. 点击"继续前往 101-43-172-231.nip.io（不安全）"
```

**APK内WebView**：
- 已在代码中信任自签名证书（`onReceivedSslError`处理）
- 用户无需操作

### 3.3 iOS证书信任

**Safari首次访问**：
```
1. 提示"此连接不是私密连接"
2. 点击"显示详细信息"
3. 点击"访问此网站"
4. 确认
```

**系统级信任（可选，体验更好）**：
```
1. 下载证书：https://101-43-172-231.nip.io:18443/cert.pem
2. 设置 → 通用 → VPN与设备管理 → 安装描述文件
3. 设置 → 通用 → 关于本机 → 证书信任设置
4. 开启"mobile-ops"证书
```

### 3.4 PC/Mac证书信任

**Chrome（推荐，一次性）**：
```
1. 访问时点击"高级"
2. 点击"继续前往..."（不安全）
3. 下次自动记住
```

**Mac系统级信任**：
```
1. Safari访问，导出证书
2. 打开"钥匙串访问"
3. 将证书拖入"系统"钥匙串
4. 双击证书 → "信任" → "始终信任"
```

---

## 四、飞书/微信消息集成方案

### 4.1 飞书集成方案

#### 方案A：飞书机器人Webhook（推荐，最简单）

**优点**：
- 无需审批，群管理员可直接配置
- 支持私人版/企业版飞书
- 可发送富文本/卡片消息

**集成步骤**：
```
1. 飞书群 → 设置 → 群机器人 → 添加机器人
2. 选择"自定义机器人" → 获取Webhook URL
3. CloudPilot后端配置：
   FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
4. 告警触发时POST到Webhook
```

**代码示例**（后端）：
```go
func sendFeishuAlert(webhook string, alert Alert) error {
    msg := map[string]interface{}{
        "msg_type": "interactive",
        "card": map[string]interface{}{
            "header": map[string]interface{}{
                "title": map[string]string{
                    "content": "🚨 CloudPilot 告警",
                    "tag": "plain_text",
                },
                "template": "red",
            },
            "elements": []map[string]interface{}{
                {
                    "tag": "div",
                    "text": map[string]string{
                        "content": fmt.Sprintf("**集群**: %s\n**告警**: %s\n**时间**: %s", 
                            alert.Cluster, alert.Summary, alert.StartsAt),
                        "tag": "lark_md",
                    },
                },
                {
                    "tag": "action",
                    "actions": []map[string]interface{}{
                        {
                            "tag": "button",
                            "text": map[string]string{"content": "查看详情", "tag": "plain_text"},
                            "url": fmt.Sprintf("https://101-43-172-231.nip.io:18443/alerts"),
                            "type": "default",
                        },
                    },
                },
            },
        },
    }
    body, _ := json.Marshal(msg)
    _, err := http.Post(webhook, "application/json", bytes.NewReader(body))
    return err
}
```

#### 方案B：飞书开放平台API（功能更强，需审批）

**适用场景**：
- 需要@具体人
- 需要发送到多个群
- 需要消息已读回执

**集成步骤**：
```
1. 飞书开放平台创建企业自建应用
2. 申请权限：im:message、im:message.group_at
3. 获取 app_id 和 app_secret
4. 后端通过API发送消息
```

**限制**：私人版飞书可能无法创建应用，需企业版。

### 4.2 微信集成方案

#### 方案A：企业微信群机器人（推荐）

**前提**：公司有企业微信

**集成步骤**：
```
1. 企业微信群 → 群设置 → 群机器人 → 添加
2. 获取Webhook URL
3. 后端配置：
   WECHAT_WORK_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
4. POST JSON消息
```

**代码示例**：
```go
func sendWechatWorkAlert(webhook string, alert Alert) error {
    msg := map[string]interface{}{
        "msgtype": "markdown",
        "markdown": map[string]string{
            "content": fmt.Sprintf(
                "## 🚨 CloudPilot 告警\n\n"+
                "> 集群: <font color=\"warning\">%s</font>\n"+
                "> 告警: %s\n"+
                "> 时间: %s\n\n"+
                "[查看详情](https://101-43-172-231.nip.io:18443/alerts)",
                alert.Cluster, alert.Summary, alert.StartsAt,
            ),
        },
    }
    body, _ := json.Marshal(msg)
    _, err := http.Post(webhook, "application/json", bytes.NewReader(body))
    return err
}
```

#### 方案B：个人微信（技术上可行，但违规）

**方式**：第三方微信机器人框架（如WeChatFerry、itchat）

**风险**：
- 违反微信用户协议
- 账号可能被封
- **不推荐用于生产**

**替代方案**：通过CloudPilot App内消息 + 本地通知

### 4.3 当前最佳实践

**阶段一：内部试用（当前）**
```
✅ CloudPilot App本地通知（震动+TTS+悬浮窗）
✅ 飞书群机器人Webhook（5分钟集成）
⏸️  微信：暂不集成（风险高，收益低）
```

**阶段二：部门推广**
```
✅ 飞书群机器人 + CloudPilot App双通道
✅ 企业微信群机器人（如果有）
✅ 邮件通知（备选）
```

**阶段三：全公司（如需要）**
```
✅ 接入公司统一消息平台（如有）
✅ 飞书开放平台API（企业版）
⏸️  短信告警（成本高，仅P0事件）
```

---

## 五、快速推广Checklist

### 5.1 准备阶段

- [ ] 录制演示视频（60秒版+完整版）
- [ ] 制作二维码海报（APK下载+群二维码）
- [ ] 准备FAQ文档（安装/证书/常见问题）
- [ ] 配置飞书机器人Webhook
- [ ] 准备几个真实故障场景截图（告警/日志/监控）

### 5.2 发布渠道

**内部渠道**：
- [ ] 飞书运维群发布（@all）
- [ ] 飞书工作台添加快捷方式
- [ ] 公司Wiki/文档平台发文章
- [ ] 技术周会演示（5分钟Lightning Talk）

**外部渠道（可选）**：
- [ ] GitHub README添加演示GIF
- [ ] 掘金/CSDN发技术文章
- [ ] B站/YouTube发演示视频
- [ ] 技术社区（V2EX/Ruby China）

### 5.3 话术模板

**飞书群发布**：
```
@所有人 

🚀 内部工具上线：CloudPilot 云驾 - 手机K8s运维神器

💡 核心功能：
✅ 手机查看Pod日志/事件/监控
✅ 容器终端执行命令
✅ 告警TTS语音播报+悬浮窗
✅ 云日志搜索（CLS）
✅ 安全组一键加白

📱 Android安装：
扫码下载APK（或访问GitHub Releases）
[二维码图片]

🍎 iOS/电脑：
Safari访问 https://101-43-172-231.nip.io:18443/
添加到主屏幕即可

📹 演示视频：
[视频链接或直接上传]

🔗 文档：
https://github.com/kiddingmonkey/mobile-ops

📮 反馈：
本群直接@我，或提GitHub Issue
```

### 5.4 用户引导流程

**Day 1：安装**
```
1. 发送安装链接+二维码
2. 提供安装视频教程
3. 设置飞书机器人答疑（24h内响应）
```

**Day 3：使用培训**
```
1. 线上/线下小培训（30分钟）
2. 演示3个常用场景：
   - 查Pod日志定位错误
   - 监控图表看资源使用
   - 容器终端重启服务
3. 分发FAQ文档
```

**Week 1：收集反馈**
```
1. 飞书群征集使用体验
2. 统计活跃用户数（后端metrics）
3. 根据反馈快速迭代
```

---

## 六、多端数据同步方案

### 6.1 当前架构

```
前端（PWA）
   ↓ HTTPS API
后端（Go Gin）
   ↓ PostgreSQL
数据库（共享）
```

**数据同步**：天然同步
- 所有端（Android/iOS/iPad/PC）请求同一个后端API
- 用户登录态通过JWT token维护
- 配置/告警/操作记录存储在数据库，跨端共享

### 6.2 实时更新方案

**当前：轮询**
```
告警页面每30秒轮询一次
```

**升级方案：WebSocket**
```go
// 后端添加WebSocket路由
router.GET("/ws", handler.WebSocketHandler)

// 前端连接
const ws = new WebSocket('wss://101-43-172-231.nip.io:18443/ws')
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type === 'new_alert') {
    // 实时推送新告警
    showNotification(msg.alert)
  }
}
```

**优点**：
- 新告警秒级推送到所有在线设备
- 节省流量（不用轮询）
- 用户体验更好

**实现成本**：后端2-3小时开发

### 6.3 离线支持（PWA已有）

**Service Worker缓存**：
- 静态资源缓存（HTML/CSS/JS）
- API响应缓存（集群列表/Pod列表）
- 离线时展示缓存数据

**IndexedDB存储**：
- 可扩展存储历史告警/日志
- 离线查看最近1小时数据

---

## 七、成本与收益分析

### 7.1 推广成本

| 项目 | 成本 | 备注 |
|------|------|------|
| 视频制作 | 0元（自己录剪） | 或外包300-800元 |
| iOS TestFlight | $99/年 | 可选，PWA免费 |
| 服务器 | 已有 | 10.211.79.100复用 |
| 域名SSL证书 | 0元 | 自签名 |
| 飞书机器人 | 0元 | Webhook免费 |
| **总计** | **0-800元/年** | 最低成本可以为0 |

### 7.2 收益（定性）

**效率提升**：
- 故障响应时间：30分钟 → 5分钟
- 无需打开电脑，地铁上即可处理
- 告警第一时间知晓（语音+震动）

**团队收益**：
- 降低oncall心智负担
- 提高SLA（服务可用性）
- 工具自研，积累技术口碑

**个人收益**：
- 技术栈拓展（PWA/Capacitor/K8s）
- 开源项目经验
- 内部影响力提升

---

## 八、推广时间线（建议）

**Week 1：准备**
- 录制视频
- 制作海报/二维码
- 准备FAQ文档
- 配置飞书机器人

**Week 2：小范围试用**
- 邀请5-10个运维同事安装
- 收集反馈，快速修bug
- 优化使用体验

**Week 3：部门推广**
- 飞书群正式发布
- 技术周会演示
- 1对1指导安装

**Week 4：效果评估**
- 统计活跃用户
- 收集反馈改进
- 规划下一版本功能

**Month 2：全公司推广**
- 公司Wiki发文章
- 内部技术分享会
- 考虑开源到GitHub（如需要）

---

## 九、常见问题（FAQ）

### Q1: iOS为什么不能装APK？
A: iOS系统限制，只能通过App Store或TestFlight安装。推荐用PWA（Safari添加到主屏幕），功能95%可用。

### Q2: 证书不安全怎么办？
A: 这是自签名证书的正常提示。点击"高级" → "继续前往"即可。企业内网使用完全安全。

### Q3: APK下载很慢？
A: GitHub在国内访问慢，使用镜像加速链接：
```
https://ghproxy.com/https://github.com/kiddingmonkey/mobile-ops/releases/latest/download/cloudpilot-latest.apk
```

### Q4: 告警能不能发到微信？
A: 个人微信不支持（违规风险）。推荐用企业微信群机器人或飞书机器人。

### Q5: 电脑能用吗？
A: 能，直接Chrome访问 https://101-43-172-231.nip.io:18443/ 或安装PWA桌面应用。

### Q6: 数据会同步吗？
A: 会，所有设备登录同一账号，数据实时同步（存储在服务器）。

### Q7: 支持哪些K8s集群？
A: 支持腾讯TKE、阿里ACK、自建K8s（任意kubeconfig）。

### Q8: 能扩容吗？
A: 能，支持腾讯云TKE节点池扩容。

### Q9: 源码开放吗？
A: 已开源：https://github.com/kiddingmonkey/mobile-ops

### Q10: 后续有什么计划？
A: 
- WebSocket实时推送
- 更多云厂商支持（华为云/AWS）
- Deployment/StatefulSet扩缩容
- 自定义告警规则

---

*文档版本: v1.0 | 日期: 2026-07-17*
*项目: CloudPilot 云驾 | 作者: 运维团队*
