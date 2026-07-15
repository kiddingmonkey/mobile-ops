-- 001_init.sql
-- Mobile-Ops MVP 初始化 schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(64) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(64),
    email           VARCHAR(128),
    role            VARCHAR(32) DEFAULT 'operator',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Grafana 数据源配置（前端可配置）
CREATE TABLE IF NOT EXISTS grafana_sources (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,
    url             VARCHAR(512) NOT NULL,
    token_encrypted BYTEA NOT NULL,
    is_default      BOOLEAN DEFAULT FALSE,
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Prometheus / VictoriaMetrics 数据源
CREATE TABLE IF NOT EXISTS prometheus_sources (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,
    url             VARCHAR(512) NOT NULL,
    auth_type       VARCHAR(32) DEFAULT 'none',  -- none/basic/bearer
    auth_encrypted  BYTEA,
    is_default      BOOLEAN DEFAULT FALSE,
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 腾讯云账号（AK/SK）
CREATE TABLE IF NOT EXISTS cloud_accounts (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,
    provider        VARCHAR(32) NOT NULL,        -- tencent
    region          VARCHAR(64) NOT NULL,        -- ap-beijing/ap-shanghai
    secret_id_encrypted BYTEA NOT NULL,
    secret_key_encrypted BYTEA NOT NULL,
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- K8s 集群配置（前端可配置新增）
CREATE TABLE IF NOT EXISTS clusters (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(128) UNIQUE NOT NULL,
    display_name        VARCHAR(128),
    provider            VARCHAR(32) DEFAULT 'tencent',   -- tencent
    provider_cluster_id VARCHAR(128),                    -- cls-xxx (TKE ClusterId)
    region              VARCHAR(64),
    cloud_account_id    BIGINT REFERENCES cloud_accounts(id),
    kubeconfig_encrypted BYTEA,
    grafana_source_id   BIGINT REFERENCES grafana_sources(id),
    grafana_cluster_var VARCHAR(64),                     -- Grafana 里 cluster 变量的值
    prom_source_id      BIGINT REFERENCES prometheus_sources(id),
    status              VARCHAR(16) DEFAULT 'active',
    created_by          BIGINT REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 节点池（可从腾讯云 TKE 同步过来）
CREATE TABLE IF NOT EXISTS node_pools (
    id                  BIGSERIAL PRIMARY KEY,
    cluster_id          BIGINT REFERENCES clusters(id) ON DELETE CASCADE,
    name                VARCHAR(128) NOT NULL,
    provider_pool_id    VARCHAR(128),                    -- np-xxx (TKE NodePoolId)
    min_size            INT DEFAULT 0,
    max_size            INT DEFAULT 100,
    desired_size        INT,
    current_size        INT,
    instance_type       VARCHAR(64),
    cost_per_hour       NUMERIC(10, 4),
    labels              JSONB DEFAULT '{}'::jsonb,
    taints              JSONB DEFAULT '[]'::jsonb,
    last_synced_at      TIMESTAMPTZ,
    UNIQUE(cluster_id, name)
);

-- 操作日志（审计核心）
CREATE TABLE IF NOT EXISTS operations (
    id                  BIGSERIAL PRIMARY KEY,
    operation_id        VARCHAR(64) UNIQUE NOT NULL,     -- 幂等 ID
    user_id             BIGINT REFERENCES users(id),
    cluster_id          BIGINT REFERENCES clusters(id),
    node_pool_id        BIGINT REFERENCES node_pools(id),
    action              VARCHAR(32),                     -- scale_up/scale_down/sync/precheck
    delta               INT,
    target_size         INT,
    status              VARCHAR(32),                     -- pending/prechecking/executing/polling/success/failed
    precheck_result     JSONB,
    trigger_source      VARCHAR(32),                     -- alert/manual/shortcut
    alert_ref           VARCHAR(128),
    error_msg           TEXT,
    started_at          TIMESTAMPTZ DEFAULT NOW(),
    finished_at         TIMESTAMPTZ,
    metadata            JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_operations_started ON operations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_user ON operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);

-- 告警缓存
CREATE TABLE IF NOT EXISTS alerts_cache (
    id              BIGSERIAL PRIMARY KEY,
    fingerprint     VARCHAR(128) UNIQUE,
    cluster_id      BIGINT REFERENCES clusters(id),
    severity        VARCHAR(16),
    alertname       VARCHAR(256),
    summary         TEXT,
    description     TEXT,
    labels          JSONB,
    annotations     JSONB,
    status          VARCHAR(16),                          -- firing/resolved
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    received_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_starts ON alerts_cache(starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts_cache(status);

-- 快捷指令
CREATE TABLE IF NOT EXISTS shortcuts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(128) NOT NULL,
    cluster_id      BIGINT REFERENCES clusters(id),
    node_pool_id    BIGINT REFERENCES node_pools(id),
    action          VARCHAR(32),
    delta           INT,
    icon            VARCHAR(32) DEFAULT 'thunderbolt',
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 监控快照（离线降级）
CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    cluster_id      BIGINT REFERENCES clusters(id) ON DELETE CASCADE,
    snapshot_at     TIMESTAMPTZ DEFAULT NOW(),
    metrics         JSONB,
    source          VARCHAR(32)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_cluster_time
    ON metrics_snapshots(cluster_id, snapshot_at DESC);
