package services

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"

	"mobile-ops/internal/config"
)

var ipRegex = regexp.MustCompile(`^([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)`)

type DialingService struct {
	db       *sqlx.DB
	cfg      config.DialingConfig
	http     *http.Client
	tokenMu  sync.RWMutex
	token    string
	tokenExp time.Time
}

func NewDialingService(db *sqlx.DB, cfg config.DialingConfig) *DialingService {
	return &DialingService{
		db:    db,
		cfg:   cfg,
		http:  &http.Client{Timeout: 120 * time.Second},
		token: cfg.Token,
	}
}

// RunPoller 每 pull_interval_seconds 拉一次 dialingTaskList
func (s *DialingService) RunPoller(ctx context.Context) {
	if !s.cfg.Enabled {
		logrus.Info("dialing poller disabled")
		return
	}
	interval := time.Duration(s.cfg.PullIntervalSeconds) * time.Second
	if interval < 60*time.Second {
		interval = 5 * time.Minute
	}
	logrus.WithField("interval", interval).Info("dialing poller started")

	// 首次立刻拉一次
	if err := s.SyncAll(ctx); err != nil {
		logrus.WithError(err).Warn("dialing initial sync failed")
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.SyncAll(ctx); err != nil {
				logrus.WithError(err).Warn("dialing sync failed")
			}
		}
	}
}

// getToken 拿当前 token; 未来若能拿到 login 接口，可在此实现自动 refresh
func (s *DialingService) getToken(ctx context.Context) (string, error) {
	s.tokenMu.RLock()
	tok := s.token
	s.tokenMu.RUnlock()
	if tok == "" {
		return "", fmt.Errorf("dialing token empty; 配置 dialing.token 或实现登录接口")
	}
	return tok, nil
}

// callAPI POST/GET monitor.zhixue.com; 401 时打印警告
func (s *DialingService) callAPI(ctx context.Context, method, path string, form url.Values) ([]byte, error) {
	tok, err := s.getToken(ctx)
	if err != nil {
		return nil, err
	}
	fullURL := strings.TrimRight(s.cfg.BaseURL, "/") + path
	var body io.Reader
	if method == http.MethodPost && form != nil {
		body = strings.NewReader(form.Encode())
	} else if method == http.MethodGet && form != nil && len(form) > 0 {
		fullURL += "?" + form.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, fullURL, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if method == http.MethodPost {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	}
	req.Header.Set("token", tok)
	req.Header.Set("Referer", strings.TrimRight(s.cfg.BaseURL, "/")+"/uoamp-end/uoamp-front/")

	resp, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	// 拨测平台有 Authorized users only banner 会混进响应体首行
	if idx := strings.Index(string(raw), "{"); idx > 0 {
		raw = raw[idx:]
	}
	if resp.StatusCode == 401 {
		return nil, fmt.Errorf("dialing api 401: token expired, 需要重新登录")
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("dialing api %d: %s", resp.StatusCode, string(raw))
	}
	return raw, nil
}

// SyncAll 全量拉取拨测任务并入库
func (s *DialingService) SyncAll(ctx context.Context) error {
	start := time.Now()
	var syncID int64
	_ = s.db.QueryRowContext(ctx, `INSERT INTO dialing_sync_status (started_at) VALUES (NOW()) RETURNING id`).Scan(&syncID)

	// 检查 token 有效期，快过期时 warn
	if status, err := s.GetTokenStatus(ctx); err == nil {
		if needRefresh, ok := status["needRefresh"].(bool); ok && needRefresh {
			remaining, _ := status["remainingDays"].(int)
			logrus.WithField("remainingDays", remaining).Warn("dialing token 即将过期，请手动刷新")
		}
	}

	page := 1
	total := 0
	var syncErr error
	for {
		form := url.Values{}
		form.Set("applicationId", s.cfg.ApplicationID)
		form.Set("alarmGroupIds", "")
		form.Set("currentPage", fmt.Sprintf("%d", page))
		form.Set("pageSize", "100")
		raw, err := s.callAPI(ctx, http.MethodPost, "/uoamp-end/dialingTask/dialingTaskList.do", form)
		if err != nil {
			syncErr = err
			break
		}
		var resp struct {
			Code string `json:"code"`
			Msg  string `json:"msg"`
			Data struct {
				CurrentPage int              `json:"currentPage"`
				TotalPages  int              `json:"totalPages"`
				Count       int              `json:"count"`
				List        []map[string]any `json:"list"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			syncErr = fmt.Errorf("parse list: %w", err)
			break
		}
		if resp.Code != "00100000" {
			syncErr = fmt.Errorf("dialing list rc=%s msg=%s", resp.Code, resp.Msg)
			break
		}
		for _, item := range resp.Data.List {
			if err := s.upsertTask(ctx, item); err != nil {
				logrus.WithError(err).Warn("upsert dialing task failed")
			}
			total++
		}
		if resp.Data.CurrentPage >= resp.Data.TotalPages || len(resp.Data.List) == 0 {
			break
		}
		page++
	}

	elapsed := time.Since(start).Milliseconds()
	if syncErr != nil {
		_, _ = s.db.ExecContext(ctx, `UPDATE dialing_sync_status SET finished_at=NOW(), success=false, task_count=$1, error_message=$2, duration_ms=$3 WHERE id=$4`,
			total, syncErr.Error(), elapsed, syncID)
		logrus.WithError(syncErr).WithField("count", total).Warn("dialing sync failed")
		return syncErr
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE dialing_sync_status SET finished_at=NOW(), success=true, task_count=$1, duration_ms=$2 WHERE id=$3`,
		total, elapsed, syncID)
	logrus.WithField("count", total).Info("dialing sync done")
	return nil
}

func asStr(m map[string]any, key string) string {
	if v, ok := m[key]; ok && v != nil {
		if s, ok := v.(string); ok {
			return s
		}
		return fmt.Sprint(v)
	}
	return ""
}

func asInt(m map[string]any, key string) sql.NullInt64 {
	if v, ok := m[key]; ok && v != nil {
		switch x := v.(type) {
		case float64:
			return sql.NullInt64{Int64: int64(x), Valid: true}
		case int:
			return sql.NullInt64{Int64: int64(x), Valid: true}
		case string:
			var n int64
			fmt.Sscanf(x, "%d", &n)
			if n > 0 {
				return sql.NullInt64{Int64: n, Valid: true}
			}
		}
	}
	return sql.NullInt64{}
}

func asTime(m map[string]any, key string) sql.NullTime {
	s := asStr(m, key)
	if s == "" {
		return sql.NullTime{}
	}
	// monitor.zhixue.com 返回格式 2026-07-20T01:47:59.000+0000
	for _, layout := range []string{"2006-01-02T15:04:05.000-0700", time.RFC3339Nano, time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return sql.NullTime{Time: t, Valid: true}
		}
	}
	return sql.NullTime{}
}

func extractIP(monitorPointName string) string {
	if m := ipRegex.FindStringSubmatch(monitorPointName); len(m) >= 2 {
		return m[1]
	}
	return ""
}

func (s *DialingService) upsertTask(ctx context.Context, item map[string]any) error {
	raw, _ := json.Marshal(item)
	monitorPointName := asStr(item, "monitorPointName")
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO dialing_tasks (
			dialing_task_id, dialing_task_name, application_id, application_name, description,
			monitor_point_id, monitor_point_name, monitor_point_ip,
			execution_interval, dialing_task_type, dialing_task_type_desc,
			formal_type, formal_type_desc, isactive, notification_enable,
			off_user, off_reason, off_time, owner_name, contact_group_member,
			max_retry_times, retry_interval, active_time, modify_user, modify_time,
			create_user, create_time, raw_json, synced_at
		) VALUES (
			$1,$2,$3,$4,$5,
			$6,$7,$8,
			$9,$10,$11,
			$12,$13,$14,$15,
			$16,$17,$18,$19,$20,
			$21,$22,$23,$24,$25,
			$26,$27,$28::jsonb, NOW()
		) ON CONFLICT (dialing_task_id) DO UPDATE SET
			dialing_task_name = EXCLUDED.dialing_task_name,
			description = EXCLUDED.description,
			monitor_point_id = EXCLUDED.monitor_point_id,
			monitor_point_name = EXCLUDED.monitor_point_name,
			monitor_point_ip = EXCLUDED.monitor_point_ip,
			execution_interval = EXCLUDED.execution_interval,
			isactive = EXCLUDED.isactive,
			notification_enable = EXCLUDED.notification_enable,
			off_user = EXCLUDED.off_user,
			off_reason = EXCLUDED.off_reason,
			off_time = EXCLUDED.off_time,
			owner_name = EXCLUDED.owner_name,
			contact_group_member = EXCLUDED.contact_group_member,
			active_time = EXCLUDED.active_time,
			modify_user = EXCLUDED.modify_user,
			modify_time = EXCLUDED.modify_time,
			raw_json = EXCLUDED.raw_json,
			synced_at = NOW()
	`,
		asStr(item, "dialingTaskId"), asStr(item, "dialingTaskName"),
		asStr(item, "applicationId"), asStr(item, "applicationName"),
		asStr(item, "description"),
		asStr(item, "monitorPointId"), monitorPointName, extractIP(monitorPointName),
		asInt(item, "executionInterval"),
		asStr(item, "dialingTaskType"), asStr(item, "dialingTaskTypeDesc"),
		asStr(item, "formalType"), asStr(item, "formalTypeDesc"),
		asStr(item, "isactive"), asStr(item, "notificationEnable"),
		asStr(item, "offUser"), asStr(item, "offReason"), asTime(item, "offTime"),
		asStr(item, "ownerName"), asStr(item, "contactGroupMember"),
		asInt(item, "maxRetryTimes"), asInt(item, "retryInterval"),
		asTime(item, "activeTime"), asStr(item, "modifyUser"), asTime(item, "modifyTime"),
		asStr(item, "createUser"), asTime(item, "createTime"), string(raw),
	)
	return err
}

// RerunResult 拨测平台 testDial.do 返回的复测结果，key=monitorPointId, value=文本结果
type RerunResult struct {
	Success  bool              `json:"success"`
	Message  string            `json:"message"`
	PerPoint map[string]string `json:"perPoint"`
	Elapsed  int64             `json:"elapsedMs"`
	Raw      string            `json:"raw,omitempty"`
}

// TriggerRerun 调用平台原生 testDial.do 完成一次真实复测（走平台后端到拨测点，不需要 SSH）
func (s *DialingService) TriggerRerun(ctx context.Context, taskID string) (*RerunResult, error) {
	start := time.Now()
	// 拿全量详情
	form0 := url.Values{}
	form0.Set("dialingTaskId", taskID)
	detailRaw, err := s.callAPI(ctx, http.MethodGet, "/uoamp-end/dialingTask/dialingTaskDetail.do", form0)
	if err != nil {
		return nil, fmt.Errorf("fetch detail: %w", err)
	}
	var detailResp struct {
		Code string         `json:"code"`
		Msg  string         `json:"msg"`
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(detailRaw, &detailResp); err != nil {
		return nil, fmt.Errorf("parse detail: %w", err)
	}
	if detailResp.Code != "00100000" {
		return nil, fmt.Errorf("detail rc=%s msg=%s", detailResp.Code, detailResp.Msg)
	}
	d := detailResp.Data

	// monitorConfigList 平台返回是 JSON 字符串; 反序列化后再补 operType=update 重新序列化
	var configs []map[string]any
	if raw, ok := d["monitorConfigList"].(string); ok && raw != "" {
		_ = json.Unmarshal([]byte(raw), &configs)
	} else if arr, ok := d["monitorConfigList"].([]any); ok {
		b, _ := json.Marshal(arr)
		_ = json.Unmarshal(b, &configs)
	}
	// contactGroups：优先从第一个 config 拿；否则用空串
	contactGroups := ""
	for _, c := range configs {
		if v, ok := c["contactGroups"].(string); ok && v != "" {
			contactGroups = v
			break
		}
	}
	for i := range configs {
		configs[i]["operType"] = "add"
	}
	configsJSON, _ := json.Marshal(configs)

	form := url.Values{}
	setStr := func(key, dataKey string) {
		if v, ok := d[dataKey]; ok && v != nil {
			form.Set(key, fmt.Sprint(v))
		}
	}
	setStr("iscron", "iscron")
	setStr("notificationEnable", "notificationEnable")
	setStr("dialingTaskName", "dialingTaskName")
	setStr("applicationId", "applicationId")
	setStr("dialingTaskType", "dialingTaskType")
	setStr("executionInterval", "executionInterval")
	setStr("maxRetryTimes", "maxRetryTimes")
	setStr("retryInterval", "retryInterval")
	setStr("owner", "owner")
	setStr("formalType", "formalType")
	setStr("monitorPointId", "monitorPointId")
	setStr("description", "description")
	setStr("offReason", "offReason")
	form.Set("contactGroups", contactGroups)
	setStr("notificationInterval", "notificationInterval")
	setStr("maxNotifyTimes", "maxNotifyTimes")
	setStr("outNumber", "outNumber")
	form.Set("monitorConfigList", string(configsJSON))
	form.Set("configAlarmChannels", "[]")
	setStr("ownerName", "ownerName")
	setStr("monitorPointName", "monitorPointName")
	setStr("isactive", "isactive")
	form.Set("dialingTaskId", taskID)

	raw, err := s.callAPI(ctx, http.MethodPost, "/uoamp-end/dialingTask/testDial.do", form)
	if err != nil {
		return nil, fmt.Errorf("testDial: %w", err)
	}
	var resp struct {
		Code string `json:"code"`
		Msg  string `json:"msg"`
		Data any    `json:"data"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("parse testDial: %w", err)
	}
	result := &RerunResult{
		Success:  resp.Code == "00100000",
		Message:  resp.Msg,
		PerPoint: map[string]string{},
		Elapsed:  time.Since(start).Milliseconds(),
		Raw:      string(raw),
	}
	// data 可能是 JSON 字符串或对象
	switch v := resp.Data.(type) {
	case string:
		if v != "" {
			var m map[string]any
			if err := json.Unmarshal([]byte(v), &m); err == nil {
				for k, val := range m {
					result.PerPoint[k] = fmt.Sprint(val)
				}
			} else {
				result.PerPoint["_raw"] = v
			}
		}
	case map[string]any:
		for k, val := range v {
			result.PerPoint[k] = fmt.Sprint(val)
		}
	}
	// 写复测历史
	perPointJSON, _ := json.Marshal(result.PerPoint)
	_, _ = s.db.ExecContext(ctx, `
		INSERT INTO dialing_rerun_history (dialing_task_id, triggered_by, target_ip, command, stdout, exit_code, duration_ms)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		taskID, "mobile-ops", asStr(d, "monitorPointName"), "testDial.do", string(perPointJSON),
		func() int { if result.Success { return 0 } else { return 1 } }(), result.Elapsed,
	)
	return result, nil
}

// FetchTaskDetail 拉单个任务详情并入库 monitorConfigList
func (s *DialingService) FetchTaskDetail(ctx context.Context, taskID string) (map[string]any, error) {
	form := url.Values{}
	form.Set("dialingTaskId", taskID)
	raw, err := s.callAPI(ctx, http.MethodGet, "/uoamp-end/dialingTask/dialingTaskDetail.do", form)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Code string         `json:"code"`
		Msg  string         `json:"msg"`
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("parse detail: %w", err)
	}
	if resp.Code != "00100000" {
		return nil, fmt.Errorf("detail rc=%s msg=%s", resp.Code, resp.Msg)
	}
	if err := s.upsertTask(ctx, resp.Data); err != nil {
		logrus.WithError(err).Warn("upsert on detail failed")
	}
	// monitorConfigList 在响应里是 JSON 字符串
	if raw, ok := resp.Data["monitorConfigList"].(string); ok && raw != "" {
		var configs []map[string]any
		if err := json.Unmarshal([]byte(raw), &configs); err == nil {
			for _, c := range configs {
				if err := s.upsertConfig(ctx, taskID, c); err != nil {
					logrus.WithError(err).Warn("upsert config failed")
				}
			}
			resp.Data["monitorConfigList"] = configs
		}
	}
	return resp.Data, nil
}

func (s *DialingService) upsertConfig(ctx context.Context, taskID string, c map[string]any) error {
	raw, _ := json.Marshal(c)
	contactsList := ""
	if v, ok := c["contactsNameList"]; ok {
		if b, err := json.Marshal(v); err == nil {
			contactsList = string(b)
		}
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO dialing_task_configs (
			monitor_config_id, dialing_task_id, monitor_config_name,
			plugin_id, plugin_name, request_url, extend_params,
			request_time, request_wait_time, result_keyword, keyword_type,
			max_retry_times, retry_interval, execution_order, out_number, notification_interval,
			contacts_name_list, raw_json, synced_at
		) VALUES (
			$1,$2,$3,
			$4,$5,$6,$7,
			$8,$9,$10,$11,
			$12,$13,$14,$15,$16,
			$17,$18::jsonb, NOW()
		) ON CONFLICT (monitor_config_id) DO UPDATE SET
			monitor_config_name = EXCLUDED.monitor_config_name,
			plugin_name = EXCLUDED.plugin_name,
			request_url = EXCLUDED.request_url,
			extend_params = EXCLUDED.extend_params,
			result_keyword = EXCLUDED.result_keyword,
			raw_json = EXCLUDED.raw_json,
			synced_at = NOW()
	`,
		asStr(c, "monitorConfigId"), taskID, asStr(c, "monitorConfigName"),
		asStr(c, "pluginId"), asStr(c, "pluginName"),
		asStr(c, "requestUrl"), asStr(c, "extendParams"),
		asInt(c, "requestTime"), asInt(c, "requestWaitTime"),
		asStr(c, "resultKeyword"), asStr(c, "keywordType"),
		asInt(c, "maxRetryTimes"), asStr(c, "retryInterval"),
		asInt(c, "executionOrder"), asInt(c, "outNumber"), asInt(c, "notificationInterval"),
		contactsList, string(raw),
	)
	return err
}

// GetSyncStatus 拿最近一次同步的状态（成功/失败/耗时）
func (s *DialingService) GetSyncStatus(ctx context.Context) (map[string]any, error) {
	type row struct {
		StartedAt    string  `db:"started_at"`
		FinishedAt   *string `db:"finished_at"`
		Success      bool    `db:"success"`
		TaskCount    *int    `db:"task_count"`
		ErrorMessage *string `db:"error_message"`
		DurationMs   *int    `db:"duration_ms"`
	}
	var r row
	err := s.db.GetContext(ctx, &r, `SELECT to_char(started_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
	                                         to_char(finished_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finished_at,
	                                         success, task_count, error_message, duration_ms
	                                  FROM dialing_sync_status ORDER BY started_at DESC LIMIT 1`)
	if err == sql.ErrNoRows {
		return map[string]any{"lastSync": nil}, nil
	}
	if err != nil {
		return nil, err
	}
	m := map[string]any{
		"startedAt":    r.StartedAt,
		"finishedAt":   r.FinishedAt,
		"success":      r.Success,
		"taskCount":    r.TaskCount,
		"errorMessage": r.ErrorMessage,
		"durationMs":   r.DurationMs,
	}
	return map[string]any{"lastSync": m}, nil
}

// GetTokenStatus 解析 JWT 的 iat，计算剩余有效期（基于 config.TokenTTLDays）
func (s *DialingService) GetTokenStatus(ctx context.Context) (map[string]any, error) {
	tok := s.cfg.Token
	if tok == "" {
		return map[string]any{"status": "empty", "message": "未配置 token"}, nil
	}
	// JWT 格式: header.payload.signature
	parts := strings.Split(tok, ".")
	if len(parts) != 3 {
		return map[string]any{"status": "invalid", "message": "token 格式错误"}, nil
	}
	// 解析 payload (base64 decode)
	payloadRaw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		// 可能带 padding，尝试 StdEncoding
		payloadRaw, err = base64.RawStdEncoding.DecodeString(parts[1])
		if err != nil {
			return map[string]any{"status": "invalid", "message": "payload 解码失败"}, nil
		}
	}
	var payload struct {
		Iat int64 `json:"iat"`
	}
	if err := json.Unmarshal(payloadRaw, &payload); err != nil {
		return map[string]any{"status": "invalid", "message": "payload JSON 解析失败"}, nil
	}
	if payload.Iat == 0 {
		return map[string]any{"status": "invalid", "message": "JWT 无 iat 字段"}, nil
	}
	ttlDays := s.cfg.TokenTTLDays
	if ttlDays <= 0 {
		ttlDays = 30 // 默认 30 天
	}
	issuedAt := time.Unix(payload.Iat, 0)
	expireAt := issuedAt.Add(time.Duration(ttlDays) * 24 * time.Hour)
	remaining := time.Until(expireAt)
	remainingDays := int(remaining.Hours() / 24)

	needRefresh := remainingDays < 3
	return map[string]any{
		"status":        "ok",
		"issuedAt":      issuedAt.Format(time.RFC3339),
		"expireAt":      expireAt.Format(time.RFC3339),
		"remainingDays": remainingDays,
		"needRefresh":   needRefresh,
	}, nil
}


