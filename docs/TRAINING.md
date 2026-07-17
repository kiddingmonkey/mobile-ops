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
│   │   ├── Alerts.tsx         # 告警中心
│   │   ├── Logs.tsx           # 日志（CLS + 容器）
│   │   ├── Scale.tsx          # 扩容向导
│   │   ├── Operations.tsx     # 操作记录
│   │   ├── Settings.tsx       # 设置页
│   │   ├── Login.tsx          # 登录页
│   │   └── settings/          # 设置子页面
│   ├── store/
│   │   └── index.ts           # Zustand状态管理
│   ├── styles/
│   │   └── global.css         # 全局样式 + 深浅主题
│   └── utils/
│       ├── otaUpdater.ts      # OTA热更新逻辑
│       ├── appUpdate.ts       # APK自动更新
│       ├── publicIP.ts        # 公网IP获取（多源）
│       ├── alertNotifier.ts   # 本地通知推送
│       ├── sgStorage.ts       # 安全组模板存储
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
| 文件系统 | @capacitor/filesystem | OTA更新存储 |
| 本地通知 | @capacitor/local-notifications | 告警推送 |
| 触觉反馈 | @capacitor/haptics | 操作反馈 |
| App生命周期 | @capacitor/app | 前后台切换 |

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
  GET  /api/v1/me                 # 当前用户
  GET  /api/v1/clusters           # 集群列表
  GET  /api/v1/clusters/:id/overview  # 集群概览
  GET  /api/v1/clusters/:id/metrics   # 集群指标
  POST /api/v1/scale/precheck     # 扩容预检
  POST /api/v1/scale/submit       # 扩容提交
  GET  /api/v1/alerts             # 告警列表
  POST /api/v1/cls/search         # CLS日志搜索
  GET  /api/v1/security-groups/whitelists   # 白名单列表
  POST /api/v1/security-groups/whitelists   # 创建白名单
  ...
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

```
┌─────────────────────────────────────────────────────────┐
│ 设置页 → 检查更新                                        │
│   ├─ GET /api/v1/updates/latest（获取最新dist.zip版本）   │
│   ├─ 对比当前版本hash                                    │
│   └─ 有新版本 → 提示更新                                 │
│                                                         │
│ 用户确认更新                                             │
│   ├─ 下载dist.zip（前端编译包）                          │
│   ├─ fflate解压到 Filesystem.Data                       │
│   ├─ WebView.setServerBasePath（切换资源目录）            │
│   └─ window.location.reload()（重载生效）                │
│                                                         │
│ 优点：无需重装APK，秒级更新                              │
│ 限制：只能更新前端资源，不能更新原生代码                   │
└─────────────────────────────────────────────────────────┘
```

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
  - Pod管理（列表/详情/日志/事件）
  - Namespace管理
  - K8s资源查看（Deployment/Service/ConfigMap等）
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
  Prometheus → AlertManager → Webhook → 后端 → 手机通知

后端处理：
  1. 接收AlertManager webhook
  2. 解析告警信息（labels/annotations）
  3. 存储到数据库
  4. 下次App打开时展示

本地通知：
  - Capacitor Local Notifications
  - 告警未读计数
  - 振动提醒
```

### 7.6 云日志(CLS)

```
功能：
  - 选择地域/日志集/日志主题
  - 无关键词查看最新日志
  - 关键词搜索（支持CLS语法）
  - JSON日志自动解析为字段
  - 字段点击自动生成查询语句
  - 日志下载

CLS查询语法：
  - * (全部)
  - keyword (关键词)
  - field:"value" (字段精确匹配)
  - level:ERROR (日志级别)
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
解决：多源冗余（6个服务依次尝试）
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

*文档版本: v1.0 | 更新日期: 2026-07-17*
