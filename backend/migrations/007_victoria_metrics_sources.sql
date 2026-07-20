-- VictoriaMetrics 数据源配置表
CREATE TABLE IF NOT EXISTS victoria_metrics_sources (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    url           TEXT NOT NULL,
    description   TEXT,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vm_sources_default ON victoria_metrics_sources(is_default) WHERE is_default = TRUE;

-- 插入默认 VM 源（用户提供的 vmui + 数据库地址）
INSERT INTO victoria_metrics_sources (name, url, description, is_default)
VALUES
  ('VictoriaMetrics VMUI', 'http://172.22.67.24:8481', 'VictoriaMetrics VMUI 查询界面', TRUE),
  ('VictoriaMetrics DB', 'http://172.22.67.24:11002/select/0/prometheus', 'VictoriaMetrics 数据库地址（用于 API 查询）', FALSE)
ON CONFLICT (name) DO NOTHING;
