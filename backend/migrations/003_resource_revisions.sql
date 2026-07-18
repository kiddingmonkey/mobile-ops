-- 资源 YAML 修改历史，用于回滚
CREATE TABLE IF NOT EXISTS resource_revisions (
    id BIGSERIAL PRIMARY KEY,
    cluster_id BIGINT NOT NULL,
    api_version TEXT NOT NULL,
    kind TEXT NOT NULL,
    namespace TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    yaml_content TEXT NOT NULL,
    operator TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_revisions_lookup
    ON resource_revisions (cluster_id, api_version, kind, namespace, name, created_at DESC);
