-- Alertmanager 数据源配置表
CREATE TABLE IF NOT EXISTS alertmanager_sources (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    url           TEXT NOT NULL,
    description   TEXT,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alertmanager_sources_default ON alertmanager_sources(is_default) WHERE is_default = TRUE;

-- 插入默认 Alertmanager 源（用户提供的地址）
INSERT INTO alertmanager_sources (name, url, description, is_default)
VALUES ('主 Alertmanager', 'http://172.22.67.24:10055', '主生产环境 Alertmanager', TRUE)
ON CONFLICT (name) DO NOTHING;
