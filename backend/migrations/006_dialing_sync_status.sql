-- 拨测同步状态：每次 poller 跑完写一条，前端展示最后同步时间/失败原因
CREATE TABLE IF NOT EXISTS dialing_sync_status (
    id            BIGSERIAL PRIMARY KEY,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ,
    success       BOOLEAN NOT NULL DEFAULT FALSE,
    task_count    INTEGER,
    error_message TEXT,
    duration_ms   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_dialing_sync_status_started ON dialing_sync_status(started_at DESC);
