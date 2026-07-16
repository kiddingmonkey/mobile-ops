-- 安全组白名单模板 (全局作用域)
CREATE TABLE IF NOT EXISTS security_group_whitelists (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(128) NOT NULL,       -- 显示名, e.g. "运维手机访问 18443"
    cloud_account_id    BIGINT NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
    region              VARCHAR(64) NOT NULL,        -- ap-beijing/ap-shanghai...
    sg_id               VARCHAR(64) NOT NULL,        -- sg-xxxxxxxx
    port                VARCHAR(32) NOT NULL DEFAULT 'ALL',  -- 443 / 80,443 / ALL
    protocol            VARCHAR(16) NOT NULL DEFAULT 'TCP',  -- TCP/UDP/ALL
    description         VARCHAR(255),                -- 规则备注, 用于识别历史规则
    last_ip             VARCHAR(64),                 -- 上次更新的 IP
    last_updated_at     TIMESTAMPTZ,
    created_by          BIGINT REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sgw_cloud ON security_group_whitelists(cloud_account_id);
