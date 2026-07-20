-- 拨测任务缓存 (对齐 monitor.zhixue.com dialingTaskList.do 返回结构)
CREATE TABLE IF NOT EXISTS dialing_tasks (
    dialing_task_id       TEXT PRIMARY KEY,
    dialing_task_name     TEXT NOT NULL,
    application_id        TEXT NOT NULL,
    application_name      TEXT,
    description           TEXT,
    monitor_point_id      TEXT,
    monitor_point_name    TEXT,
    monitor_point_ip      TEXT,
    execution_interval    INTEGER,
    dialing_task_type     TEXT,
    dialing_task_type_desc TEXT,
    formal_type           TEXT,
    formal_type_desc      TEXT,
    isactive              TEXT,
    notification_enable   TEXT,
    off_user              TEXT,
    off_reason            TEXT,
    off_time              TIMESTAMPTZ,
    owner_name            TEXT,
    contact_group_member  TEXT,
    max_retry_times       INTEGER,
    retry_interval        INTEGER,
    active_time           TIMESTAMPTZ,
    modify_user           TEXT,
    modify_time           TIMESTAMPTZ,
    create_user           TEXT,
    create_time           TIMESTAMPTZ,
    raw_json              JSONB,
    synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dialing_tasks_isactive ON dialing_tasks(isactive);
CREATE INDEX IF NOT EXISTS idx_dialing_tasks_notification ON dialing_tasks(notification_enable);
CREATE INDEX IF NOT EXISTS idx_dialing_tasks_monitor_point ON dialing_tasks(monitor_point_id);
CREATE INDEX IF NOT EXISTS idx_dialing_tasks_name ON dialing_tasks USING GIN (to_tsvector('simple', dialing_task_name));

-- 拨测详情里的 monitorConfigList (含脚本/URL/参数)
CREATE TABLE IF NOT EXISTS dialing_task_configs (
    monitor_config_id     TEXT PRIMARY KEY,
    dialing_task_id       TEXT NOT NULL REFERENCES dialing_tasks(dialing_task_id) ON DELETE CASCADE,
    monitor_config_name   TEXT,
    plugin_id             TEXT,
    plugin_name           TEXT,
    request_url           TEXT,
    extend_params         TEXT,
    request_time          INTEGER,
    request_wait_time     INTEGER,
    result_keyword        TEXT,
    keyword_type          TEXT,
    max_retry_times       INTEGER,
    retry_interval        TEXT,
    execution_order       INTEGER,
    out_number            INTEGER,
    notification_interval INTEGER,
    contacts_name_list    TEXT,
    raw_json              JSONB,
    synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dialing_configs_task ON dialing_task_configs(dialing_task_id);

-- 复测执行历史 (Phase 2 会写入; Phase 1 表建好但暂不写)
CREATE TABLE IF NOT EXISTS dialing_rerun_history (
    id               BIGSERIAL PRIMARY KEY,
    dialing_task_id  TEXT NOT NULL,
    monitor_config_id TEXT,
    triggered_by     TEXT NOT NULL,
    target_ip        TEXT,
    command          TEXT,
    stdout           TEXT,
    stderr           TEXT,
    exit_code        INTEGER,
    duration_ms      INTEGER,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rerun_task_time ON dialing_rerun_history(dialing_task_id, started_at DESC);
