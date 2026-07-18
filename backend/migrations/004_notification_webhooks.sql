-- 告警推送 webhook 配置（飞书群机器人、企业微信群机器人等）
CREATE TABLE IF NOT EXISTS notification_webhooks (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'feishu',  -- feishu / wecom / dingtalk
    webhook_url TEXT NOT NULL,
    secret TEXT NOT NULL DEFAULT '',      -- 签名密钥（飞书/钉钉）
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    min_severity TEXT NOT NULL DEFAULT 'warning', -- info/warning/critical
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON notification_webhooks (enabled) WHERE enabled = TRUE;
