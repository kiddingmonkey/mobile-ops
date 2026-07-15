# Mobile-Ops 技术架构设计

> 版本：v1.0（MVP）
> 依据：`01-requirements.md`

---

## 一、系统架构总览

```
┌─────────────────────────────────────────────────────────┐
│                  飞书小程序（TMA）                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Pages: 首页 / 监控 / 操作 / 日志 / 设置         │   │
│  │  Components: MetricCard / AlertList / ScaleForm  │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS (JWT)
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Go 后端 API (Gin + gRPC-Gateway)           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Router (Gin)                                     │   │
│  │ ├── /api/v1/auth        Feishu OAuth            │   │
│  │ ├── /api/v1/clusters    集群管理                 │   │
│  │ ├── /api/v1/metrics     监控聚合                 │   │
│  │ ├── /api/v1/alerts      告警列表                 │   │
│  │ ├── /api/v1/scale       扩缩容                   │   │
│  │ ├── /api/v1/precheck    预检查                   │   │
│  │ ├── /api/v1/operations  操作日志                 │   │
│  │ └── /api/v1/shortcuts   快捷指令                 │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ Service Layer                                    │   │
│  │ ├── AuthService                                  │   │
│  │ ├── MetricsAggregator (Grafana + Prom + K8s)     │   │
│  │ ├── ClusterService (client-go)                   │   │
│  │ ├── ScaleService (预检 + 执行 + 轮询)            │   │
│  │ └── AuditService                                 │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ Client Layer                                     │   │
│  │ ├── GrafanaClient                                │   │
│  │ ├── PrometheusClient                             │   │
│  │ ├── K8sClient (client-go, 多集群)                │   │
│  │ ├── FeishuClient (OAuth + 消息推送)              │   │
│  │ └── CloudProviderClient (V2)                     │   │
│  └──────────────────────────────────────────────────┘   │
└────┬──────────────┬──────────────┬───────────┬─────────┘
     │              │              │           │
     ▼              ▼              ▼           ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│PostgreSQL│  │ Grafana  │  │Prometheus│  │  K8s API │
│          │  │   API    │  │   API    │  │  (多集群)│
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## 二、数据模型（PostgreSQL）

### 2.1 表结构

```sql
-- 用户表（飞书 OAuth）
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    feishu_user_id VARCHAR(64) UNIQUE NOT NULL,
    name          VARCHAR(64) NOT NULL,
    email         VARCHAR(128),
    role          VARCHAR(32) DEFAULT 'operator', -- operator/admin
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 集群配置表
CREATE TABLE clusters (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(64) UNIQUE NOT NULL,     -- prod-cluster-01
    display_name  VARCHAR(128),                    -- 生产集群 01
    provider      VARCHAR(32),                     -- huawei/aliyun/tencent/self
    region        VARCHAR(64),
    kubeconfig    TEXT NOT NULL,                   -- AES-256 加密存储
    grafana_url   VARCHAR(256),
    prom_url      VARCHAR(256),
    status        VARCHAR(16) DEFAULT 'active',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 节点池配置
CREATE TABLE node_pools (
    id            BIGSERIAL PRIMARY KEY,
    cluster_id    BIGINT REFERENCES clusters(id),
    name          VARCHAR(128) NOT NULL,
    provider_id   VARCHAR(256),                    -- 云厂商侧的节点池 ID
    min_size      INT DEFAULT 1,
    max_size      INT DEFAULT 100,
    instance_type VARCHAR(64),                     -- 8C16G
    cost_per_hour NUMERIC(10, 4),                  -- 单价元/小时
    labels        JSONB,
    UNIQUE(cluster_id, name)
);

-- 操作日志（审计）
CREATE TABLE operations (
    id            BIGSERIAL PRIMARY KEY,
    operation_id  VARCHAR(64) UNIQUE NOT NULL,     -- 幂等 ID
    user_id       BIGINT REFERENCES users(id),
    cluster_id    BIGINT REFERENCES clusters(id),
    node_pool_id  BIGINT REFERENCES node_pools(id),
    action        VARCHAR(32),                     -- scale_up/scale_down
    delta         INT,                             -- +2 / -1
    status        VARCHAR(32),                     -- pending/running/success/failed
    precheck      JSONB,                           -- 5 项预检查结果
    trigger_source VARCHAR(32),                    -- alert/manual/shortcut
    alert_id      VARCHAR(128),                    -- 关联告警
    error_msg     TEXT,
    started_at    TIMESTAMPTZ DEFAULT NOW(),
    finished_at   TIMESTAMPTZ,
    metadata      JSONB
);

-- 告警缓存（本地缓存最近告警）
CREATE TABLE alerts_cache (
    id            BIGSERIAL PRIMARY KEY,
    alert_id      VARCHAR(128) UNIQUE,
    cluster_id    BIGINT REFERENCES clusters(id),
    severity      VARCHAR(16),                     -- info/warning/critical
    title         VARCHAR(256),
    description   TEXT,
    metric        VARCHAR(128),
    fired_at      TIMESTAMPTZ,
    resolved_at   TIMESTAMPTZ,
    raw_payload   JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 快捷指令
CREATE TABLE shortcuts (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT REFERENCES users(id),
    name          VARCHAR(128),                    -- "prod-web 扩容 2 台"
    cluster_id    BIGINT REFERENCES clusters(id),
    node_pool_id  BIGINT REFERENCES node_pools(id),
    action        VARCHAR(32),
    delta         INT,
    icon          VARCHAR(32),
    sort_order    INT DEFAULT 0
);

-- 监控快照（离线降级用）
CREATE TABLE metrics_snapshots (
    id            BIGSERIAL PRIMARY KEY,
    cluster_id    BIGINT REFERENCES clusters(id),
    snapshot_at   TIMESTAMPTZ,
    metrics       JSONB,                           -- {cpu, memory, pods, ...}
    source        VARCHAR(32)                      -- grafana/prometheus/kubectl
);
CREATE INDEX idx_metrics_cluster_time ON metrics_snapshots(cluster_id, snapshot_at DESC);
```

### 2.2 加密方案

- **kubeconfig / AK-SK**：AES-256-GCM 加密
- **密钥来源**：环境变量 `MOBILE_OPS_ENCRYPTION_KEY`（32 字节）
- **密钥管理**：写入 `/data2/haowu33/mobile/.env`，权限 600

---

## 三、核心 API 设计

### 3.1 认证类

```
POST /api/v1/auth/feishu/login
Body: { "code": "feishu-oauth-code" }
Response: { "token": "jwt...", "user": {...} }

GET /api/v1/auth/me
Header: Authorization: Bearer <jwt>
Response: { "user": {...} }
```

### 3.2 集群与监控

```
GET /api/v1/clusters
Response: [
  {
    "id": 1,
    "name": "prod-01",
    "health": "warning",
    "metrics": {
      "cpu":    { "value": 73.2, "source": "grafana",    "timestamp": "..." },
      "memory": { "value": 68.5, "source": "prometheus", "timestamp": "..." },
      "pods":   { "value": 145,  "capacity": 200 },
      "nodes":  { "value": 8, "not_ready": 0 }
    },
    "cross_check": {
      "cpu": {
        "grafana": 73.2,
        "kubectl_top": 68.0,
        "diff_pct": 7.1
      }
    }
  }
]

GET /api/v1/clusters/:id/metrics?window=5m
Response: {
  "cpu": [{time, value}, ...],
  "memory": [...],
  "grafana_panel_url": "https://grafana.../d-solo/xxx?panelId=1"
}
```

### 3.3 告警

```
GET /api/v1/alerts?limit=10
Response: [
  {
    "id": "alert-uuid",
    "severity": "critical",
    "title": "Pod OOMKilled",
    "cluster_id": 1,
    "fired_at": "...",
    "suggestion": null   // MVP 不填，V2 由 AI 填充
  }
]
```

### 3.4 扩缩容（核心）

```
POST /api/v1/precheck
Body: {
  "cluster_id": 1,
  "node_pool_id": 5,
  "action": "scale_up",
  "delta": 2
}
Response: {
  "passed": true,           // 5 项全过才 true
  "checks": [
    {"name": "quota",         "passed": true, "message": "配额剩余 20 台"},
    {"name": "node_status",   "passed": true, "message": "全部 Ready"},
    {"name": "recent_ops",    "passed": true, "message": "最近 5 分钟无操作"},
    {"name": "cost_estimate", "passed": true, "message": "预计增加 480 元/月"},
    {"name": "node_pool",     "passed": true, "message": "节点池 prod-web 可用"}
  ],
  "estimated_cost_per_month": 480.00,
  "estimated_ready_time": "3-5 分钟"
}

POST /api/v1/scale
Body: {
  "operation_id": "uuid-generated-by-client",   // 幂等
  "cluster_id": 1,
  "node_pool_id": 5,
  "action": "scale_up",
  "delta": 2,
  "trigger_source": "alert",
  "alert_id": "alert-uuid"
}
Response: {
  "operation_id": "uuid",
  "status": "running",
  "started_at": "..."
}

GET /api/v1/operations/:operation_id
Response: {
  "operation_id": "uuid",
  "status": "running",     // pending / running / success / failed
  "progress": {
    "current_step": "waiting_node_ready",
    "steps": [
      {"name": "precheck",           "status": "success", "duration_ms": 200},
      {"name": "call_provider_api",  "status": "success", "duration_ms": 1200},
      {"name": "wait_node_ready",    "status": "running", "elapsed_ms": 45000},
      {"name": "verify_capacity",    "status": "pending"}
    ]
  },
  "new_nodes": ["node-xxx", "node-yyy"]
}
```

### 3.5 快捷指令

```
GET /api/v1/shortcuts
POST /api/v1/shortcuts
DELETE /api/v1/shortcuts/:id
POST /api/v1/shortcuts/:id/execute
```

---

## 四、关键技术决策

### 4.1 监控数据聚合器（MetricsAggregator）

**目标**：单次请求内并发拉取 Grafana + Prometheus + kubectl top，做交叉验证。

```go
type MetricsAggregator struct {
    grafana    *GrafanaClient
    prometheus *PrometheusClient
    k8s        *K8sClient
    cache      *Cache  // 30s TTL
}

func (a *MetricsAggregator) GetClusterMetrics(clusterID int64) (*Metrics, error) {
    // 1. 并发拉取三方数据
    var wg sync.WaitGroup
    var grafanaData, promData, kubectlData MetricData
    
    wg.Add(3)
    go func() { defer wg.Done(); grafanaData = a.grafana.Query(...) }()
    go func() { defer wg.Done(); promData    = a.prometheus.Query(...) }()
    go func() { defer wg.Done(); kubectlData = a.k8s.TopNodes(...) }()
    wg.Wait()
    
    // 2. 打时间戳
    // 3. 计算差异百分比
    // 4. 组装返回
}
```

**超时策略**：单个数据源超时 2s，聚合总超时 3s；超时后进入降级模式（读快照）。

### 4.2 扩缩容状态机

```
[Client 发起 scale]
       ↓
    [Pending]
       ↓ precheck 通过
    [Running: call_provider_api]
       ↓
    [Running: wait_node_ready]  (轮询 K8s API，每 5s 一次)
       ↓ 所有新节点 Ready
    [Running: verify_capacity]
       ↓
    [Success]
```

失败分支：
- precheck 失败 → `Failed(reason=precheck)`
- 云厂商 API 失败 → `Failed(reason=provider_error)`
- 超时未 Ready（10 分钟）→ `Failed(reason=timeout)`，需人工介入

### 4.3 幂等设计

- 客户端为每次操作生成 UUID（`operation_id`）
- 服务端接收后先查 `operations` 表
  - 已存在且状态非 failed → 返回原状态（不重复执行）
  - 已存在且 failed → 允许重试
  - 不存在 → 创建并执行

### 4.4 飞书 OAuth 流程

```
1. 小程序调用 tt.login() 获取 code
2. code 发送到后端 /api/v1/auth/feishu/login
3. 后端用 code + app_secret 换 access_token（飞书接口）
4. 用 access_token 换用户信息
5. 生成 JWT 返回给小程序
6. 小程序把 JWT 存 storage，后续请求带 Header
```

---

## 五、前端页面结构（飞书小程序 TMA）

```
pages/
├── index/                 首页 - 集群总览 + 快捷入口
├── monitor/               监控 - Grafana 面板嵌入 + 指标详情
├── alerts/                告警列表 + 详情
├── scale/                 扩缩容操作向导
│   ├── select/            选集群/节点池
│   ├── confirm/           预检查 + 确认
│   └── progress/          实时进度
├── operations/            操作日志
├── shortcuts/             快捷指令管理
└── settings/              集群配置、账号、退出

components/
├── MetricCard             指标卡片（带趋势箭头 + 数据源标注）
├── ClusterStatusBadge     健康状态徽标
├── AlertItem              告警条目
├── PrecheckList           预检查结果列表
├── ProgressStepper        进度步骤条
├── ConfirmSheet           底部弹起的确认弹窗
└── DataSourceLabel        数据源 + 时间戳标签
```

---

## 六、部署方案

### 6.1 目录结构（服务器）

```
/data2/haowu33/mobile/
├── bin/
│   └── mobile-ops-server         # Go 编译产物
├── frontend/                     # 飞书小程序源码（本地开发调试用）
├── config/
│   ├── app.yaml                  # 主配置
│   └── clusters.yaml             # 集群配置（初始化用）
├── data/
│   └── postgres/                 # 数据卷
├── logs/
│   └── mobile-ops.log
├── scripts/
│   ├── start.sh
│   ├── stop.sh
│   └── deploy.sh
├── nginx/
│   └── mobile-ops.conf           # 反代配置
├── .env                          # 环境变量（含加密密钥）
└── docker-compose.yml            # 简化部署
```

### 6.2 启动方式

**推荐 Docker Compose**（比裸机好维护）：

```yaml
services:
  postgres:
    image: postgres:16
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: <from-env>
    
  mobile-ops:
    image: mobile-ops:latest
    ports:
      - "127.0.0.1:8090:8090"
    depends_on:
      - postgres
    env_file: .env
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
```

Nginx 反代 `443 → 127.0.0.1:8090`，HTTPS 证书用现有的。

### 6.3 CI/CD

MVP 阶段简化：
- 本地开发 → `git push`
- 服务器 `git pull` → `make build` → `docker-compose up -d`

---

## 七、开发顺序（Week 1-2 排期）

### Week 1

| Day | 任务 |
|---|---|
| D1 | 后端基础架构：Gin + PostgreSQL + 迁移脚本 + 配置加载 |
| D2 | 飞书 OAuth + JWT 中间件 + 集群管理 API |
| D3 | MetricsAggregator：Grafana + Prometheus + kubectl 并发拉取 |
| D4 | 扩缩容 API：预检查 5 项 + 状态机 + 幂等 |
| D5 | 状态轮询 + 操作日志 + 快捷指令 API |

### Week 2

| Day | 任务 |
|---|---|
| D6 | 飞书小程序脚手架 + 登录页 + 首页布局 |
| D7 | 监控页 + 告警列表页 |
| D8 | 扩缩容向导（3 页：选择/确认/进度） |
| D9 | 快捷指令 + 操作日志 + 设置页 |
| D10 | 部署 + Nginx + 联调 + 冒烟测试 |

---

## 八、风险与预案

| 风险 | 概率 | 影响 | 预案 |
|---|---|---|---|
| Grafana API 慢 (>2s) | 中 | 数据不实时 | 并发拉取 + 3s 超时 + 降级快照 |
| kubectl 通过 SSH 触发超时 | 中 | 无法看 K8s 状态 | 使用 client-go 直连 K8s API（记忆里提到 unset http_proxy）|
| 扩容后节点长时间不 Ready | 低 | 用户误判失败 | 状态轮询 + 明确失败原因 + 云厂商工单链接 |
| 飞书小程序 HTTPS 域名 | **高** | 直接卡住上线 | **第一步先确认域名**，若无先申请 |
| 加密密钥丢失 | 低 | kubeconfig 无法解密 | 密钥双备份（本机 + 团队保险箱） |

---

*文档结束*
