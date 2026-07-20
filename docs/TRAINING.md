# CloudPilot 云驾 - 移动运维App 完整培训文档

## 一、项目概述

### 1.1 定位

CloudPilot 云驾是一款面向运维人员的移动端应用，让运维工程师可以通过手机随时随地管理云上基础设施。

### 1.2 核心功能

| 模块 | 功能描述 |
|------|----------|
| 集群管理 | 多集群概览、节点池、Pod管理 |
| 实时监控 | Grafana面板嵌入、Prometheus指标 |
| 弹性扩容 | 预检 → 提交 → 轮询节点Ready |
| 告警中心 | AlertManager webhook → 手机推送 |
| 云日志(CLS) | 腾讯云CLS日志查询，字段级检索 |
| 容器日志 | Pod stdout日志实时查看 |
| 安全组管理 | 一键更新白名单IP |
| OTA热更新 | 前端资源包热更新，无需重装APK |
| APK自动更新 | GitHub Releases + 镜像加速 |

### 1.3 技术栈一览

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (TypeScript)                      │
├─────────────────────────────────────────────────────────┤
│ React 18 + Vite + TypeScript                            │
│ Ant Design Mobile (UI组件)                              │
│ Capacitor 8 (Hybrid App容器)                            │
│ PWA (Service Worker离线支持)                             │
├─────────────────────────────────────────────────────────┤
│                    后端 (Go)                              │
├─────────────────────────────────────────────────────────┤
│ Gin (HTTP框架)                                          │
│ sqlx + PostgreSQL (数据持久化)                           │
│ client-go (Kubernetes API)                              │
│ 腾讯云SDK (CLS/CVM/TKE/安全组)                          │
├─────────────────────────────────────────────────────────┤
│                  基础设施                                 │
├─────────────────────────────────────────────────────────┤
│ 腾讯云CVM (后端服务器)                                   │
│ Nginx (反向代理 + HTTPS)                                 │
│ nip.io (免费域名)                                        │
│ 自签名证书 (HTTPS)                                       │
│ GitHub Actions (CI/CD)                                   │
│ GitHub Releases (APK分发)                                │
└─────────────────────────────────────────────────────────┘
```

---

## 二、架构设计

### 2.1 整体架构

```
┌──────────┐     HTTPS (18443)     ┌──────────────┐
│  手机App  │ ◀────────────────────▶ │    Nginx     │
│(Capacitor)│                        │  (反向代理)   │
└──────────┘                        └──────┬───────┘
                                           │
                                    ┌──────▼───────┐
                                    │   Go Backend  │
                                    │   (Gin:8090)  │
                                    └──────┬───────┘
                                           │
                 ┌─────────────────────────┼─────────────────────────┐
                 │                         │                         │
          ┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
          │ PostgreSQL   │          │  K8s集群     │          │  腾讯云API   │
          │  (数据存储)   │          │ (client-go) │          │(CLS/CVM/TKE)│
          └─────────────┘          └─────────────┘          └─────────────┘
```

### 2.2 网络架构

```
用户手机 (公网)
  │
  │ HTTPS:18443 (需要IP在安全组白名单)
  ▼
腾讯云安全组 ───▶ 放行白名单IP
  │
  ▼
CVM服务器 (101.43.172.231)
  │
  ├─ Nginx:18443 ─── SSL终止 ─── 代理到 127.0.0.1:8090
  │
  └─ Go Backend:8090
       ├─ PostgreSQL (本地)
       ├─ K8s API (多集群)
       └─ 腾讯云API (CLS/CVM)
```

### 2.3 免费域名方案

```
域名: 101-43-172-231.nip.io
原理: nip.io 是一个通配符DNS服务
      任何 <ip>.nip.io 会自动解析到 <ip>
优点: 免费、无需备案、即时生效
缺点: 依赖第三方服务、不支持CDN
```

---

## 三、前端技术详解

### 3.1 技术选型理由

| 技术 | 选择原因 |
|------|----------|
| React 18 | 生态成熟，组件丰富 |
| TypeScript | 类型安全，减少运行时错误 |
| Vite | 构建极快（<2s），HMR即时 |
| Ant Design Mobile | 专为移动端设计的React组件库 |
| Capacitor 8 | 比React Native更简单，Web转原生 |
| PWA | 离线支持 + 安装到桌面 |

### 3.2 项目结构

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # API客户端（axios封装）
│   ├── components/
│   │   ├── AppLayout.tsx      # 底部TabBar布局
│   │   ├── ErrorBoundary.tsx  # 错误边界
│   │   ├── RemoteStatusBanner.tsx  # 后端不可达警告
│   │   ├── UpdateChecker.tsx  # APK自动更新检查
│   │   └── PageShell.tsx      # 页面外壳（标题+返回）
│   ├── pages/
│   │   ├── Home.tsx           # 首页（集群概览）
│   │   ├── Monitor.tsx        # 监控（Grafana面板）
│   │   ├── Alerts.tsx         # 告警中心 + 测试通知
│   │   ├── Logs.tsx           # 日志（CLS + 容器）
│   │   ├── Scale.tsx          # 扩容向导
│   │   ├── Operations.tsx     # 操作记录
│   │   ├── Settings.tsx       # 设置页
│   │   ├── Login.tsx          # 登录页 + 安全组入口
│   │   ├── ClusterResources.tsx  # 集群资源列表（9种资源类型）
│   │   ├── PodDetail.tsx      # Pod详情（9个Tab）
│   │   ├── ResourceDetail.tsx # 通用资源详情页（Deploy/SVC/CM等）
│   │   └── settings/          # 设置子页面
│   ├── store/
│   │   └── index.ts           # Zustand状态管理
│   ├── styles/
│   │   └── global.css         # 全局样式 + 深浅主题
│   └── utils/
│       ├── otaUpdater.ts      # OTA热更新逻辑
│       ├── appUpdate.ts       # APK自动更新
│       ├── publicIP.ts        # 公网IP获取（多源）
│       ├── alertNotifier.ts   # 本地通知推送（震动+TTS+悬浮窗）
│       ├── floatingAlert.ts   # 自定义悬浮窗插件封装
│       ├── logShare.ts        # 日志下载/分享统一工具
│       ├── sgStorage.ts       # 安全组模板存储（客户端）
│       ├── tencentCloudAPI.ts # 腾讯云API客户端调用
│       └── format.ts          # 格式化工具
├── android/                   # Capacitor Android项目
├── capacitor.config.ts        # Capacitor配置
├── vite.config.ts             # Vite构建配置
└── package.json
```

### 3.3 主题系统

```css
/* 深色主题（默认） */
:root {
  --bg-primary: #0F1116;
  --text-primary: #F0F1F5;
}

/* 浅色主题 */
body.mo-light {
  --bg-primary: #FFFFFF;
  --text-primary: #1A1D24;
}
```

### 3.4 Capacitor原生能力

| 能力 | 插件 | 用途 |
|------|------|------|
| 文件系统 | @capacitor/filesystem | OTA更新存储、日志下载 |
| 本地通知 | @capacitor/local-notifications | 告警推送 |
| 触觉反馈 | @capacitor/haptics | 告警震动 |
| App生命周期 | @capacitor/app | 返回键、前后台切换 |
| 系统分享 | @capacitor/share | 分享日志到微信/飞书 |
| 语音播报 | @capacitor-community/text-to-speech | 紧急告警TTS |
| 悬浮窗 | FloatingAlertPlugin (自定义) | 覆盖其他App的告警 |

---

## 四、后端技术详解

### 4.1 项目结构

```
backend/
├── cmd/
│   └── server/
│       └── main.go            # 入口 + 启动逻辑
├── internal/
│   ├── api/
│   │   ├── router.go          # 路由注册
│   │   ├── handlers.go        # API处理器
│   │   ├── cls.go             # CLS日志接口
│   │   ├── security_group.go  # 安全组接口
│   │   └── updates.go         # OTA更新接口
│   ├── clients/
│   │   └── k8s.go             # Kubernetes客户端池
│   ├── config/
│   │   └── config.go          # 配置加载（YAML）
│   ├── middleware/
│   │   ├── auth.go            # JWT认证中间件
│   │   └── cors.go            # CORS中间件
│   ├── models/
│   │   └── models.go          # 数据库模型
│   ├── services/
│   │   ├── auth.go            # JWT签发/验证
│   │   ├── config.go          # 配置管理服务
│   │   ├── scale.go           # 扩容服务
│   │   └── alert.go           # 告警服务
│   └── utils/
│       └── cipher.go          # AES加密（云账号密钥）
├── config.yaml                # 运行时配置
└── go.mod
```

### 4.2 API设计

```
公开接口（无需登录）：
  POST /api/v1/auth/login         # 登录
  GET  /api/v1/health             # 健康检查
  GET  /api/v1/version/latest     # 版本检查
  POST /alertmanager/webhook      # AlertManager回调

鉴权接口（需要JWT）：
  # 用户 & 集群
  GET  /api/v1/me
  GET  /api/v1/clusters
  GET  /api/v1/clusters/:id/overview
  GET  /api/v1/clusters/:id/metrics

  # K8s 资源（Pods/Deployments/StatefulSets/DaemonSets/Services/Ingresses/ConfigMaps/Secrets/Nodes）
  GET  /api/v1/clusters/:id/resources/:type              # 列资源
  GET  /api/v1/clusters/:id/resources/:type/yaml         # 资源 YAML
  GET  /api/v1/clusters/:id/resources/:type/events       # 资源事件

  # Pod 深度操作
  GET  /api/v1/clusters/:id/pods/:ns/:name               # 详情（含调度/资源/卷）
  GET  /api/v1/clusters/:id/pods/:ns/:name/events        # 事件
  GET  /api/v1/clusters/:id/pods/:ns/:name/logs         # 日志（tail/-p）
  GET  /api/v1/clusters/:id/pods/:ns/:name/files        # 容器文件浏览
  GET  /api/v1/clusters/:id/pods/:ns/:name/file         # 读取文件内容
  POST /api/v1/clusters/:id/pods/:ns/:name/exec         # 容器内执行命令

  # 扩容 & 告警 & 云日志 & 安全组
  POST /api/v1/scale/precheck
  POST /api/v1/scale/submit
  GET  /api/v1/alerts
  POST /api/v1/cls/search
  GET  /api/v1/security-groups/whitelists
  POST /api/v1/security-groups/whitelists
```

### 4.3 多集群K8s管理

```go
// K8s客户端池：一个集群一个client，按需创建
type K8sClientPool struct {
    clients map[int64]*K8sClient  // clusterId → client
    mu      sync.RWMutex
}

// 连接方式：kubeconfig字符串（AES加密存储在DB）
// 支持：腾讯TKE、阿里ACK、自建K8s
```

### 4.4 安全设计

| 层面 | 措施 |
|------|------|
| 传输加密 | HTTPS (TLS 1.2+) |
| 认证 | JWT Token (24h过期) |
| 云密钥存储 | AES-256-GCM加密 |
| 网络隔离 | 安全组白名单 |
| 密码存储 | bcrypt哈希 |

---

## 五、CI/CD 流水线

### 5.1 GitHub Actions 工作流

```yaml
# .github/workflows/build-android.yml
触发条件：
  - push到main分支（frontend/目录变更）
  - 手动触发（workflow_dispatch）

执行步骤：
  1. 安装Node.js 22 + Java 21 + Android SDK
  2. npm ci && npm run build（编译前端）
  3. npx cap sync android（同步到Android）
  4. ./gradlew assembleDebug（编译APK）
  5. 上传APK到GitHub Releases
  6. 生成version.json（版本信息）
  7. 创建Release（带changelog）
```

### 5.2 流水线流程图

```
代码推送到main
     │
     ▼
GitHub Actions触发
     │
     ├─ 1. 编译前端 (npm run build)
     │      ├─ TypeScript类型检查
     │      ├─ Vite构建 + tree-shaking
     │      └─ 生成dist/ + version.json
     │
     ├─ 2. 打包dist.zip (OTA热更新用)
     │
     ├─ 3. Capacitor同步
     │      └─ dist/ → android/app/src/main/assets/public/
     │
     ├─ 4. Gradle编译APK
     │      └─ assembleDebug → app-debug.apk
     │
     └─ 5. 发布GitHub Release
            ├─ cloudpilot-v1.1.0.apk
            ├─ cloudpilot-latest.apk
            ├─ version.json
            └─ dist.zip
```

### 5.3 APK自动更新机制

```
┌─────────────────────────────────────────────────────────┐
│ App启动（5秒后）                                         │
│   ├─ GET /api/v1/version/latest                         │
│   │    └─ 后端 → GitHub API → 获取最新Release           │
│   ├─ 对比版本号（semver语义化版本）                       │
│   └─ 有新版本 → 弹出Dialog提示                           │
│                                                         │
│ 用户点击"立即更新"                                       │
│   ├─ download_url = ghproxy.com/...（国内镜像加速）      │
│   ├─ 后台下载APK（显示进度条）                           │
│   └─ 触发系统安装                                        │
└─────────────────────────────────────────────────────────┘
```

### 5.4 OTA热更新机制

#### 5.4.1 整体架构

```
       服务器                                     App
┌─────────────────────┐             ┌──────────────────────┐
│ dist/               │             │ 本地版本 (localStorage)│
│ ├── index.html      │             │  ├── dist_version    │
│ ├── assets/*.js     │             │  ├── saved_sha256    │
│ └── version.json    │             │  └── OTA_RESTART_... │
│                     │             │                      │
│ dist.zip (打包)     │  ───────►   │ Directory.Data/      │
│                     │  下载解压    │  webroot/{version}/  │
│ versions.json       │             │  ├── index.html      │
│ (历史变更日志)      │              │  ├── assets/*.js    │
└─────────────────────┘             │  └── version.json    │
                                    │                      │
                                    │  WebView 读这里,     │
                                    │  App 重启后生效      │
                                    └──────────────────────┘
```

#### 5.4.2 三条核心接口 (backend/internal/api/updates.go)

| 接口 | 谁调 | 干啥 |
|---|---|---|
| `GET /api/v1/updates/latest` | 手机 App 检查更新 | 返回**当前 dist.zip 的** SHA256、大小、版本号、下载地址 |
| `GET /api/v1/updates/dist.zip` | 手机 App 下载 | 直接返回 dist.zip 二进制流 |
| `GET /api/v1/updates/history` | 手机 App 查历史 | 返回 versions.json 里所有历史版本+更新日志 |
| `POST /api/v1/updates/add-version` | 部署脚本 (可选) | 追加一条 versions.json 记录 |

**关键**：
- `/updates/latest` 是**动态算的** — 每次调用实时 `sha256(dist.zip)`，服务器上文件变了 SHA256 就变
- `versions.json` 是**独立维护的更新日志** — 只给用户看，不参与更新判断

#### 5.4.3 更新判断（前端 utils/otaUpdater.ts）

```typescript
const hasUpdate = currentSha256
  ? (info.sha256 !== currentSha256)     // 优先比 SHA256（准）
  : (info.version !== currentVersion)   // 兜底比版本号
```

**只要 dist.zip 的 SHA256 变了，就判断有更新。**

#### 5.4.4 完整流程（点"检查更新"到生效）

1. **检查阶段**（GET /updates/latest）
   - 服务器实时读 dist.zip 算 SHA256
   - 前端比对本地 localStorage 里的 sha256
   - 不一样 → 有更新

2. **下载阶段**（GET /updates/dist.zip）
   - axios responseType `arraybuffer` 拿到 zip 二进制
   - 显示下载进度条

3. **校验阶段**
   - 本地 `crypto.subtle.digest('SHA-256')` 算下载文件的哈希
   - 和服务器返回的对比，防传输损坏

4. **解压阶段**（fflate 库）
   - `unzipSync(uint8array)` 内存解压
   - 从 zip 里读 `version.json` 记录新版本信息

5. **写入阶段**（Capacitor Filesystem）
   - 写到 `Directory.Data/webroot/{version}/`（App 沙盒目录，卸载才清）
   - 文本文件 UTF8 写入，二进制文件 base64 写入
   - 逐个文件写，显示 "1/N" 进度

6. **切换阶段**
   - `Filesystem.getUri` 拿绝对路径
   - **跳过** `WebView.setServerBasePath` （踩过坑：会 WebView 死锁）
   - 改成保存 `OTA_RESTART_PENDING` 标记
   - 提示用户"更新完成，请重启 App"

7. **重启后**（App.tsx 启动时）
   - 检测到 `OTA_RESTART_PENDING` 标记
   - 从 `Directory.Data/webroot/{last_version}/` 加载
   - 有 10 秒**健康检查**：如果 App 启动后 10 秒内又启动一次（说明崩了），**自动回退**到内置版本

#### 5.4.5 部署踩坑

**踩过的坑**：`scripts/deploy_frontend.sh` 只推 dist/ 和 dist.zip，**不管 versions.json**。

结果：
- `/updates/latest` 实时算的 SHA256 是新的 ✓
- 但 App 里"检查更新"UI 先读 `/updates/history` 展示可选版本 → 用户以为没更新

**修复方式**：手动更新服务器上 `/data2/haowu33/mobile/frontend/versions.json` 追加一条记录，或调用 `POST /api/v1/updates/add-version` 接口写入。

#### 5.4.6 为什么这么设计

- **无需重装 APK**：前端 JS/HTML/CSS 秒级替换，APK 走 GitHub Actions 编译要 3-5 分钟
- **健康检查回退**：Capacitor WebView 加载新代码崩溃后能自动回内置版，防止砖机
- **两份存储**：`dist/` 给 Web 浏览器（nginx 静态）+ `dist.zip` 给 App（下载解压）

---

### 5.5 拨测平台集成（智学网 monitor.zhixue.com）

#### 5.5.1 需求背景

- 大搜平台等 178 个拨测任务分散在多台拨测点机器（skyline_proxy/HWY_proxy 等）
- 收到告警要跳到拨测点上跑复测脚本验证
- 拨测点只能通过 ebgoas 4A 堡垒机访问，手工操作繁琐
- **目标**：手机端一站式查看拨测任务 + 一键复测

#### 5.5.2 整体架构

```
┌─────────────────────┐   POST 拉列表     ┌────────────────────────┐
│ mobile-ops backend  │ ───────────────► │ monitor.zhixue.com     │
│ (10.211.79.100)     │  每 5 分钟自动    │ /uoamp-end/dialingTask │
│                     │                   │ ├─ dialingTaskList.do  │
│  ├── DialingService │ ◄──────────────  │ ├─ dialingTaskDetail.do│
│  │   (定时轮询)     │  178 条拨测       │ └─ testDial.do (复测)  │
│  │                  │  含 monitorConfig │                        │
│  └── PostgreSQL     │                   │ 平台后端自己 SSH        │
│      ├─ dialing_    │                   │ 到拨测点跑脚本 (~40s)   │
│      │  tasks       │                   └────────────────────────┘
│      ├─ dialing_    │                                │
│      │  task_configs│                                ▼
│      └─ dialing_    │                   ┌────────────────────────┐
│         rerun_hist  │                   │ 拨测点机器             │
└─────────────────────┘                   │ 10.106.16.8 等         │
         ▲                                │ /data/server/          │
         │ GET /api/v1/dialing/tasks      │  desp-proxy/cmd/       │
         │ POST /rerun                    │   *.py 拨测脚本         │
         │                                │   *.json 请求参数       │
┌─────────────────────┐                   └────────────────────────┘
│ 手机 App / Web PWA  │
└─────────────────────┘
```

#### 5.5.3 关键决策：为什么走平台 testDial.do 而不是直连 SSH

尝试过的方向和结论：

| 方案 | 尝试结果 |
|------|---------|
| ❌ 10.211.79.100 直连拨测点 SSH | 10.106.16.8 网络不通、119.3.216.170 免密未配 |
| ❌ 走 ebgoas.iflysec.com 堡垒机 | Web 4A 无开放 API，无法程序化 |
| ❌ 在 10.211.79.100 上做本地拨测 | 拨测脚本本体和参数 JSON 都拿不到（plugin/downloadPlugin.do 返回 404） |
| ✅ **走平台 testDial.do** | 平台后端自己到拨测点跑，我们只拿结果；耗时约 40s，可接受 |

#### 5.5.4 后端组件

**目录结构**：
```
backend/
├── internal/
│   ├── services/dialing_service.go     # 核心逻辑
│   │   ├── DialingService struct       # http client + token 缓存
│   │   ├── RunPoller()                 # 5 分钟循环 SyncAll
│   │   ├── SyncAll()                   # 全量拉列表并入库
│   │   ├── FetchTaskDetail()           # 拉单个任务详情
│   │   └── TriggerRerun()              # 调 testDial.do 一键复测
│   ├── api/dialing.go                  # HTTP handler
│   │   ├── ListDialingTasks            # GET /dialing/tasks
│   │   ├── GetDialingTaskDetail        # GET /dialing/tasks/:id
│   │   ├── TriggerDialingRerun         # POST /dialing/tasks/:id/rerun
│   │   ├── ListDialingRerunHistory     # GET /dialing/tasks/:id/rerun-history
│   │   ├── BuildRerunCommand           # GET /dialing/tasks/:id/rerun-command
│   │   └── SyncDialingTasks            # POST /dialing/sync (手动触发同步)
│   └── config/config.go
│       └── DialingConfig               # token/url/interval 配置
└── migrations/005_dialing.sql          # 三张表
```

**config.yaml 结构**：
```yaml
dialing:
  enabled: true
  base_url: "http://monitor.zhixue.com"
  application_id: "4b916eb0bccf4c01a2c804fc6c6c0139"  # 大搜平台的 app id
  token: "eyJhbGciOi..."                              # haowu33 浏览器登录后的 JWT
  pull_interval_seconds: 300                          # 5 分钟轮询
  bastion_url: "https://ebgoas.iflysec.com/#/login"   # 手动跳堡垒机深链
  script_base_dir: "/data/server/desp-proxy/cmd"      # 拨测点上脚本目录
```

**数据表**：

- `dialing_tasks`（178 条拨测任务缓存，5 分钟刷新）
  - 主键 `dialing_task_id`
  - 常用字段：`dialing_task_name`、`monitor_point_ip`、`isactive`、`notification_enable`、`off_reason`
  - `raw_json` JSONB 保留原始响应做兜底

- `dialing_task_configs`（详情里的 monitorConfigList 展开）
  - 主键 `monitor_config_id`
  - 外键 `dialing_task_id`
  - 关键字段：`plugin_name`、`request_url`、`extend_params`

- `dialing_rerun_history`（复测历史，最近 100 条）
  - `stdout` 存 `{"skyline_proxy":"验证成功"}` 这种 perPoint JSON

#### 5.5.5 同步机制（Poller）

`DialingService.RunPoller` 启动时（main.go 里 `go dialingSvc.RunPoller(pollCtx)`）：

```go
1. 检查 cfg.Enabled，不启用直接返回
2. 立刻触发一次 SyncAll (首启不等 5 分钟)
3. time.NewTicker(pullIntervalSeconds) 循环
4. select ctx.Done() / ticker.C
```

`SyncAll` 的分页逻辑：

```
POST /uoamp-end/dialingTask/dialingTaskList.do
Body: applicationId=4b916eb0bccf4c01a2c804fc6c6c0139
     &alarmGroupIds=
     &currentPage=1
     &pageSize=100

响应 (JSON):
{
  "code": "00100000",
  "data": {
    "currentPage": 1,
    "totalPages": 2,
    "count": 178,
    "list": [...]
  }
}

循环 currentPage++ 直到 >= totalPages
每条 upsertTask() 入库 (ON CONFLICT DO UPDATE)
```

**响应体首行陷阱**：monitor.zhixue.com 返回体前面会带 `Authorized users only.` banner，需要用 `strings.Index(raw, "{")` 去掉再解析 JSON。

#### 5.5.6 一键复测流程（testDial.do）

**踩过的坑**：

1. **必须先拉详情** — testDial.do 参数几乎是完整 task 配置（20+ 字段），必须先调 `dialingTaskDetail.do` 拿全量数据再拼参数
2. **operType=add 而非 update** — 平台文档没说，用 update 会返回 `001001 操作失败`
3. **timeout ≥60s** — 平台真的到拨测点跑脚本，40s 才返回结果，短 timeout 会 502
4. **contactGroups** 要从第一个 monitorConfig 里提取到顶层字段

**调用序列**：

```
用户点"一键复测"
    │
    ▼
POST /api/v1/dialing/tasks/:id/rerun
    │
    ▼ (后端)
1. GET dialingTaskDetail.do (~200ms)
2. 解析 data.monitorConfigList JSON 字符串 → array
3. 每个 config 加 operType="add"
4. 拼 20+ 字段的 form body
5. POST testDial.do (~40s，平台内部到拨测点跑)
6. 解析 data 字段 (JSON 字符串二次解析)
    → {"skyline_proxy": "验证成功"}
7. 写 dialing_rerun_history
    │
    ▼
返回给前端: {
  success: true,
  perPoint: {"skyline_proxy": "验证成功"},
  elapsedMs: 40200
}
```

#### 5.5.7 前端组件

**目录**：
```
frontend/src/
├── pages/
│   ├── Dialing.tsx           # 列表页
│   │   ├── SearchBar         # 关键字搜索
│   │   ├── Selector          # isactive / notification 过滤
│   │   └── InfiniteScroll    # 分页加载
│   └── DialingDetail.tsx     # 详情页
│       ├── 状态卡片          # 启用/停用/通知开关/间隔
│       ├── 一键复测按钮      # 触发 /rerun
│       ├── 复测结果展示      # perPoint 结果配色
│       └── 复制命令 / 堡垒机深链 (Plan B)
├── api/client.ts
│   ├── listDialingTasks
│   ├── getDialingTaskDetail
│   ├── triggerDialingRerun   # timeout=90000
│   └── syncDialingTasks
└── App.tsx                    # 路由 /dialing 和 /dialing/:id
```

**Home 快捷入口**：📡 拨测 图标进列表页

#### 5.5.8 Token 管理（当前限制）

- JWT payload 只有 `iat` 没 `exp`，实际有效期未知
- 目前 token **硬编码在服务器 config.yaml**，过期时手动更新
- token 失效表现：手机端调 rerun 报 500，服务器日志 `dialing api 401`
- 后续可加：`login_url` + 用户名密码，401 时自动 refresh（预留了 `Username/Password/LoginURL` 字段）

#### 5.5.9 如何添加新的拨测

**完全不用改代码**：

1. 在 monitor.zhixue.com 界面添加拨测任务
2. 等 5 分钟或调用 `POST /api/v1/dialing/sync` 立即同步
3. 手机端下拉刷新即可看到

---


## 六、部署指南

### 6.1 服务器要求

| 项目 | 要求 |
|------|------|
| 操作系统 | CentOS 7+ / Ubuntu 18+ |
| CPU | 2核+ |
| 内存 | 4GB+ |
| 磁盘 | 50GB+ |
| 网络 | 公网IP |
| 依赖 | Nginx, PostgreSQL |

### 6.2 部署步骤

```bash
# 1. 安装依赖
yum install -y nginx postgresql-server

# 2. 初始化数据库
postgresql-setup initdb
systemctl start postgresql

# 3. 创建数据库
su - postgres -c "createdb mobile_ops"
su - postgres -c "psql mobile_ops < schema.sql"

# 4. 上传后端二进制
scp mobile-ops root@server:/data2/haowu33/mobile/backend/bin/

# 5. 配置systemd服务
cat > /etc/systemd/system/mobile-ops.service << EOF
[Unit]
Description=Mobile-Ops Backend Server
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/data2/haowu33/mobile/backend
ExecStart=/data2/haowu33/mobile/backend/bin/mobile-ops
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mobile-ops
systemctl start mobile-ops

# 6. 生成自签名证书
openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/CN=101-43-172-231.nip.io"

# 7. 配置Nginx（HTTPS反向代理）
# → /etc/nginx/conf.d/mobile-ops.conf

# 8. 部署前端
scp -r dist/* root@server:/data2/haowu33/mobile/frontend/dist/

# 9. 创建管理员账号
./mobile-ops -create-admin -user admin -pass YourPassword
```

### 6.3 免费域名配置

```
无需任何配置！
域名格式：<IP用横杠分隔>.nip.io
例如：101-43-172-231.nip.io → 解析到 101.43.172.231

用于：
- HTTPS证书的CN（Common Name）
- App中的API地址
- Capacitor的server.hostname配置
```

### 6.4 安全组配置

```
腾讯云控制台 → 安全组 → 入站规则：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 22 | 0.0.0.0/0 | SSH |
| TCP | 18443 | 白名单IP | HTTPS (App) |
| TCP | 8090 | 127.0.0.1 | 后端(仅本地) |
| TCP | 5432 | 127.0.0.1 | PG(仅本地) |
```

---

## 七、功能模块详解

### 7.1 安全组白名单管理

```
痛点：运维人员经常出差，IP变动频繁
      每次都要登录云控制台修改安全组

解决方案：
  1. App获取当前公网IP（多源冗余）
  2. 选择/新建白名单模板
  3. 一键API调用更新安全组规则
  4. 模板存储在客户端localStorage

IP获取源（按优先级）：
  - ipinfo.io
  - ip.sb
  - ipify
  - icanhazip
  - myip.la
  - ipapi
```

### 7.2 多集群管理

```
支持的集群类型：
  - 腾讯云TKE
  - 阿里云ACK
  - 自建K8s（任意kubeconfig）

功能：
  - 集群列表 + 健康状态
  - 节点池管理
  - Namespace管理

支持的 K8s 资源类型（全部支持列表 + YAML + 事件）：
  Workloads: Pods / Deployments / StatefulSets / DaemonSets
  Network:   Services / Ingresses
  Config:    ConfigMaps / Secrets
  Infra:     Nodes

Pod 详情（9 个 Tab）：
  详情 / 容器 / 事件 / 监控 / 日志 / 文件 / 终端 / YAML
  - 详情：状态、基础信息、Labels、资源需求、调度信息（NodeSelector/Tolerations/Affinity）、Volumes、Conditions
  - 监控：时间范围切换 + Grafana面板嵌入
  - 日志：容器切换 + tail行数（100/200/500/1000/2000） + 上次崩溃(-p) + 字体调整 + 下载/分享
  - 文件：路径导航 + 常用路径快捷方式 + 文件预览 + 下载/分享
  - 终端：sh -c 命令执行 + 快捷命令 + 输出染色

通用资源详情（Deployment/Service/CM 等，3 个 Tab）：
  基础信息 / 事件 / YAML（可下载分享）
```

### 7.3 Grafana监控嵌入

```
原理：
  - 后端生成带认证的Grafana面板URL
  - 前端WebView加载Grafana面板
  - 支持多数据源（多个Grafana实例）
  - 支持Dashboard列表和Panel选择
```

### 7.4 弹性扩容

```
扩容流程：
  1. 预检（precheck）
     - 验证集群连通性
     - 检查节点池配额
     - 估算费用
  2. 提交（submit）
     - 调用TKE API扩容节点
     - 创建操作记录
  3. 轮询（poller）
     - 后台每30s检查节点状态
     - 节点Ready后更新操作记录
     - 超时15分钟标记为失败
```

### 7.5 告警中心

```
告警链路：
  Prometheus → AlertManager → Webhook → 后端 → 手机
                                              ↓
                                        本地通知 + 震动 + TTS + 悬浮窗

后端处理：
  1. 接收AlertManager webhook
  2. 解析告警信息（labels/annotations）
  3. 存储到数据库
  4. 前端定时轮询拉取

前端通知能力（alertNotifier.ts）：
  - 本地通知（Capacitor Local Notifications）
  - 震动模式：critical=连续3次强震动 / warning=单次
  - 语音播报（@capacitor-community/text-to-speech）
  - 悬浮窗（自定义 FloatingAlertPlugin，可覆盖抖音等其他App）
  - 三个开关独立控制（TTS/悬浮/通知）

告警页测试功能：
  - 测试紧急告警（全功能触发）
  - 测试警告告警（震动+通知）
  - 单独测试 TTS 语音播报
  - 权限申请引导（悬浮窗需 SYSTEM_ALERT_WINDOW）
```

### 7.6 云日志(CLS)

```
功能：
  - 选择地域/日志集/日志主题
  - 时间范围选择（5m/15m/30m/1h/3h/6h/12h/24h）
  - 无关键词查看最新日志（默认发送 * 查询）
  - 关键词搜索（支持CLS语法）
  - JSON日志自动解析为字段列表
  - 字段点击自动生成查询语句
  - 日志下载 + 分享到微信/飞书

CLS查询语法：
  - * (全部)
  - keyword (关键词)
  - field:"value" (字段精确匹配)
  - level:ERROR (日志级别)
```

### 7.7 日志下载与分享 (utils/logShare.ts)

```
统一工具，容器日志/云日志/文件内容全部通用：

downloadLog(content, filename):
  - Web端: 触发浏览器 <a download> 下载
  - App端: 写入 Filesystem.Cache

shareLog({content, filename, title}):
  - Web端: Web Share API 或降级下载
  - App端: @capacitor/share 弹出系统分享面板
           → 用户选择微信/飞书/邮件/QQ...

makeLogFilename(prefix):
  - 生成安全文件名：prefix_YYYYMMDD_HHmmss.log
  - 过滤非法字符
```

### 7.8 容器文件浏览 & 终端

```
文件浏览 (FilesTab):
  - 容器切换
  - 路径导航：上级 / 根目录 / 刷新
  - 快捷路径：/var/log /tmp /app /etc /root /home
  - 目录浏览：ls -la 解析，点击进入
  - 文件预览：head -c 5MB 限制
  - 字体调整（A- / A+）
  - 下载 + 分享

容器终端 (TerminalTab):
  - 通过 kubectl exec (SPDY) 一次性执行
  - 命令：sh -c "..." 支持管道/重定向
  - 快捷命令：ls -la, pwd, df -h, free -h, ps aux, env, cat /etc/hostname
  - 历史记录：时间戳 + stdout(白)/stderr(黄)/error(红) 染色
  - 字体调整、清空历史

后端实现 (backend/internal/clients/k8s.go)：
  - K8sClient.ExecInPod: SPDY executor
  - K8sClient.ListFilesInPod: ls -la 输出解析
  - K8sClient.CatFileInPod / TailFileInPod
  - shellEscape 防注入
```

### 7.9 APK 自动更新（GitHub Releases + 镜像加速）

```
版本发布流程：
  1. GitHub Actions 编译 APK
  2. 自动创建 GitHub Release + tag v{version}
  3. 上传 cloudpilot-latest.apk / cloudpilot-v{ver}.apk / version.json / dist.zip

App 检查更新：
  1. App 启动 5 秒后自动检查
  2. 请求后端 /api/v1/version/latest
  3. 后端调 GitHub API 拿最新 Release
  4. 对比版本号，弹出更新提示
  5. 用户点击 → 下载（ghproxy.com 镜像）→ 系统安装

关键点：
  - permissions: contents: write（Actions需要）
  - workflow中 make_latest: true
  - version.json 里 download_url 走镜像
  - 国内访问 GitHub 慢 → 用 ghproxy.com / gh.ddlc.top
```

---

## 八、从零到落地全流程

### 8.1 环境准备（Day 1）

```
1. 腾讯云CVM一台（2C4G，约50元/月）
2. GitHub账号（免费）
3. Mac/Linux开发机
4. Node.js 22 + Go 1.22 + Android Studio
```

### 8.2 初始化项目（Day 1-2）

```bash
# 前端
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install antd-mobile @capacitor/core @capacitor/cli
npx cap init
npx cap add android

# 后端
mkdir backend && cd backend
go mod init mobile-ops
go get github.com/gin-gonic/gin
go get github.com/jmoiron/sqlx
go get k8s.io/client-go
```

### 8.3 核心开发（Day 3-14）

```
Week 1:
  - 登录/认证系统
  - 集群管理CRUD
  - K8s客户端池
  - Pod列表/日志

Week 2:
  - Grafana嵌入
  - 扩容功能
  - 告警中心
  - 安全组管理
  - CLS日志
```

### 8.4 移动端适配（Day 15-17）

```
- Capacitor配置
- Android打包调试
- 自签名证书处理
- 安全组白名单流程
- OTA热更新
```

### 8.5 CI/CD搭建（Day 18-19）

```
- GitHub Actions工作流
- 自动编译APK
- 自动创建Release
- OTA包上传
```

### 8.6 上线部署（Day 20）

```
- 服务器部署
- Nginx配置
- 域名配置
- 安全组配置
- 创建管理员账号
- 分发APK
```

---

## 九、关键设计决策

### 9.1 为什么选Capacitor而不是React Native？

| 对比维度 | Capacitor | React Native |
|---------|-----------|--------------|
| 学习成本 | 低（纯Web技术） | 高（特有组件） |
| UI组件库 | 直接用Web组件库 | 需要RN专用库 |
| 调试体验 | Chrome DevTools | Flipper/Metro |
| 性能 | WebView渲染 | 原生渲染 |
| 适用场景 | 运维工具类 | 高频交互类 |

结论：运维App不需要60fps动画，Capacitor开发效率更高。

### 9.2 为什么用nip.io而不是买域名？

```
场景特点：
  - 内部工具，不面向公众
  - 团队人数少（<20人）
  - 不需要SEO
  - 不需要CDN

nip.io优势：
  - 完全免费
  - 无需备案（避免2-4周等待）
  - 即时生效
  - IP变了直接换域名
```

### 9.3 为什么用自签名证书？

```
原因：
  - nip.io不支持Let's Encrypt（需要验证域名所有权）
  - 内部工具不需要公信CA
  - Capacitor配置 allowMixedContent + trustAllCerts

做法：
  - openssl生成自签名证书
  - Nginx配置SSL
  - Android Capacitor信任自签名证书
```

### 9.4 为什么OTA + APK双更新？

```
OTA热更新：
  - 只更新前端资源（JS/CSS/HTML）
  - 秒级更新，无需重装
  - 适用于：UI修复、功能迭代

APK整包更新：
  - 更新原生代码（Capacitor插件/Android配置）
  - 需要重新安装
  - 适用于：原生能力变更

组合使用：
  - 日常迭代走OTA（快速）
  - 大版本走APK（完整）
```

---

## 十、常见问题

### Q1: 手机显示"网络不通"

```
原因：IP不在安全组白名单
解决：
  1. 查看App显示的当前公网IP
  2. 在安全组中添加该IP
  3. 确保端口包含TCP:18443
  4. 等待30秒App自动重试
```

### Q2: OTA更新卡住

```
原因：WebView.setServerBasePath不resolve
解决：已添加3秒超时保护，自动reload
```

### Q3: 容器日志按钮不能点

```
原因：后端需返回Pod的containers字段
解决：已修复PodInfo结构，包含容器列表
```

### Q4: APK下载慢

```
原因：GitHub在国内访问慢
解决：使用ghproxy.com镜像加速
```

### Q5: IP获取失败

```
原因：部分IP查询服务被墙或超时
解决：多源冗余（6个服务依次尝试，含 ipinfo/ip.sb/ipify/icanhazip 等）
      UI显示实时进度：正在通过 xxx 获取 (N/M)
      失败时列出每个服务的失败原因（超时/HTTP错误/网络错误）
```

### Q6: 深色主题下选择框看不见文字

```
原因：antd-mobile 组件默认样式没适配深色
解决：global.css 覆盖 .adm-* 类的 color 变量
```

### Q7: 云日志显示"未找到匹配的日志"但期望有

```
原因：默认只查最近 15 分钟
解决：切换时间范围（5m/15m/30m/1h/3h/6h/12h/24h）
```

### Q8: 白名单加了IP还是登不上

```
原因：
  1. 安全组只加了 SSH 22 端口，没加 18443
  2. 手机运营商 NAT 出口 IP 和 ipinfo.io 查到的不一致
解决：
  1. 确认端口开 TCP:18443
  2. 切换 WiFi/移动网络对比验证
  3. 极端情况可临时对 0.0.0.0/0 开放 18443
```

### Q9: COS 上传超时（GitHub Actions → 腾讯云）

```
原因：GitHub Actions runner 到国内 COS 网络不稳定
解决：改用 GitHub Releases + 国内镜像加速（ghproxy.com）
      COS 方案因禁止用默认域名分发 APK 已放弃
```

### Q10: 侧滑手势直接退出 App

```
原因：Android/iOS 系统侧滑手势没被 WebView 拦截
解决：
  - iOS: allowsBackForwardNavigationGestures: false
  - Android: 监听 @capacitor/app backButton 事件，
            canGoBack 时走 history.back()
```

---

## 十一、项目仓库

```
GitHub: https://github.com/kiddingmonkey/mobile-ops

目录结构：
mobile-ops/
├── frontend/          # 前端代码
├── backend/           # 后端代码
├── scripts/           # 部署脚本
├── docs/              # 文档
├── .github/
│   └── workflows/     # CI/CD工作流
└── README.md
```

---

## 十二、成本清单

| 项目 | 月费用 | 说明 |
|------|--------|------|
| 腾讯云CVM | ~50元 | 2C4G轻量云 |
| 域名 | 0元 | nip.io免费 |
| 证书 | 0元 | 自签名 |
| GitHub | 0元 | 免费仓库 |
| GitHub Actions | 0元 | 免费额度2000min/月 |
| APK分发 | 0元 | GitHub Releases |
| 总计 | ~50元/月 | |

---

## 十三、变更历史

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| v1.0 | 2026-07-17 | 初始版本，覆盖架构/前后端/CI-CD/部署 |
| v1.1 | 2026-07-17 | 补齐 K8s 全资源类型 (StatefulSet/DaemonSet/Ingress)；Pod 详情增强 (NodeSelector/Tolerations/Affinity/Volumes/资源汇总)；ResourceDetail 通用详情页；Pod 监控 Tab (Grafana嵌入)；容器文件浏览 + 终端；日志下载/分享；APK 更新改走 GitHub Releases + ghproxy 镜像；深色主题适配；侧滑手势拦截；告警 TTS + 悬浮窗 + 测试功能；FAQ 扩展到 10 条 |
| v1.2 | 2026-07-17 | 【UX优化】深色模式select文字可见、云日志自动展示、日志按钮缩小、终端倒序、查看日志跳转；【功能】所有日志ERROR高亮（红底+左边框）；【监控】Pod监控Tab改用ECharts时序图（CPU/内存/网络），从Prometheus拉数据；【修复】OTA卡住（getUri超时保护+兜底reload）；【文档】新增推广方案(PROMOTION.md): 宣传视频制作/多端安装/证书信任/飞书微信集成/数据同步架构 |
| v1.3 | 2026-07-20 | 【新模块】拨测平台集成 (5.5 章节)：接入 monitor.zhixue.com 178 条拨测任务、5 分钟自动同步、一键复测走 testDial.do、复测历史；【修复】Grafana 智能 Viewer 走后端代理，解决 iframe 加载内网 Grafana 失败问题；后端 RequireAuth 中间件加 `_token` query 参数兜底 iframe 鉴权；【文档】5.4 OTA 章节完整重写，加架构图/接口清单/流程/踩坑 |

---

*文档版本: v1.3 | 最近更新: 2026-07-20 | 项目: CloudPilot 云驾*
*每次功能改动请同步更新此文档，与代码一起 commit*
