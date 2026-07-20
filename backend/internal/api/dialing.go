package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type dialingTaskRow struct {
	DialingTaskID       string  `db:"dialing_task_id" json:"dialingTaskId"`
	DialingTaskName     string  `db:"dialing_task_name" json:"dialingTaskName"`
	ApplicationName     *string `db:"application_name" json:"applicationName,omitempty"`
	Description         *string `db:"description" json:"description,omitempty"`
	MonitorPointName    *string `db:"monitor_point_name" json:"monitorPointName,omitempty"`
	MonitorPointIP      *string `db:"monitor_point_ip" json:"monitorPointIp,omitempty"`
	ExecutionInterval   *int    `db:"execution_interval" json:"executionInterval,omitempty"`
	Isactive            *string `db:"isactive" json:"isactive,omitempty"`
	NotificationEnable  *string `db:"notification_enable" json:"notificationEnable,omitempty"`
	OffReason           *string `db:"off_reason" json:"offReason,omitempty"`
	OwnerName           *string `db:"owner_name" json:"ownerName,omitempty"`
	FormalTypeDesc      *string `db:"formal_type_desc" json:"formalTypeDesc,omitempty"`
	SyncedAt            string  `db:"synced_at" json:"syncedAt"`
}

// ListDialingTasks GET /dialing/tasks
// query: keyword, isactive(1/0), notification_enable(1/0), page(1-based), page_size(default 50)
func (h *Handler) ListDialingTasks(c *gin.Context) {
	keyword := c.Query("keyword")
	isactive := c.Query("isactive")
	notification := c.Query("notification_enable")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	if pageSize < 1 || pageSize > 200 {
		pageSize = 50
	}

	where := "WHERE 1=1"
	args := []interface{}{}
	i := 1
	if keyword != "" {
		where += " AND (dialing_task_name ILIKE $" + strconv.Itoa(i) + " OR description ILIKE $" + strconv.Itoa(i) + ")"
		args = append(args, "%"+keyword+"%")
		i++
	}
	if isactive != "" {
		where += " AND isactive = $" + strconv.Itoa(i)
		args = append(args, isactive)
		i++
	}
	if notification != "" {
		where += " AND notification_enable = $" + strconv.Itoa(i)
		args = append(args, notification)
		i++
	}

	var total int
	if err := h.db.Get(&total, "SELECT COUNT(*) FROM dialing_tasks "+where, args...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	args = append(args, pageSize, (page-1)*pageSize)
	rows := []dialingTaskRow{}
	q := `SELECT dialing_task_id, dialing_task_name, application_name, description,
	       monitor_point_name, monitor_point_ip, execution_interval,
	       isactive, notification_enable, off_reason, owner_name, formal_type_desc,
	       to_char(synced_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS synced_at
	     FROM dialing_tasks ` + where +
		" ORDER BY dialing_task_name LIMIT $" + strconv.Itoa(i) + " OFFSET $" + strconv.Itoa(i+1)
	if err := h.db.Select(&rows, q, args...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"items":     rows,
	})
}

// GetDialingTaskDetail GET /dialing/tasks/:id
// 优先从 monitor.zhixue.com 实时拉，失败则回退 DB 缓存
func (h *Handler) GetDialingTaskDetail(c *gin.Context) {
	id := c.Param("id")
	if h.dialing != nil {
		if data, err := h.dialing.FetchTaskDetail(c.Request.Context(), id); err == nil {
			c.JSON(http.StatusOK, gin.H{"source": "live", "data": data})
			return
		} else {
			// 降级：读缓存
			c.Header("X-Dialing-Live-Error", err.Error())
		}
	}
	var task dialingTaskRow
	err := h.db.Get(&task, `SELECT dialing_task_id, dialing_task_name, application_name, description,
	       monitor_point_name, monitor_point_ip, execution_interval,
	       isactive, notification_enable, off_reason, owner_name, formal_type_desc,
	       to_char(synced_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS synced_at
	     FROM dialing_tasks WHERE dialing_task_id=$1`, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	type configRow struct {
		MonitorConfigID   string  `db:"monitor_config_id" json:"monitorConfigId"`
		MonitorConfigName *string `db:"monitor_config_name" json:"monitorConfigName,omitempty"`
		PluginName        *string `db:"plugin_name" json:"pluginName,omitempty"`
		RequestURL        *string `db:"request_url" json:"requestUrl,omitempty"`
		ExtendParams      *string `db:"extend_params" json:"extendParams,omitempty"`
		ResultKeyword     *string `db:"result_keyword" json:"resultKeyword,omitempty"`
	}
	configs := []configRow{}
	_ = h.db.Select(&configs, `SELECT monitor_config_id, monitor_config_name, plugin_name,
	       request_url, extend_params, result_keyword
	     FROM dialing_task_configs WHERE dialing_task_id=$1 ORDER BY execution_order`, id)
	c.JSON(http.StatusOK, gin.H{
		"source": "cache",
		"data": gin.H{
			"task":              task,
			"monitorConfigList": configs,
		},
	})
}

// TriggerDialingRerun POST /dialing/tasks/:id/rerun
// 走平台原生 testDial.do，不需要 SSH
func (h *Handler) TriggerDialingRerun(c *gin.Context) {
	if h.dialing == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "dialing service disabled"})
		return
	}
	id := c.Param("id")
	result, err := h.dialing.TriggerRerun(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ListDialingRerunHistory GET /dialing/tasks/:id/rerun-history
func (h *Handler) ListDialingRerunHistory(c *gin.Context) {
	id := c.Param("id")
	type row struct {
		ID          int64   `db:"id" json:"id"`
		TriggeredBy string  `db:"triggered_by" json:"triggeredBy"`
		TargetIP    *string `db:"target_ip" json:"targetIp,omitempty"`
		Stdout      *string `db:"stdout" json:"stdout,omitempty"`
		ExitCode    int     `db:"exit_code" json:"exitCode"`
		DurationMs  int     `db:"duration_ms" json:"durationMs"`
		StartedAt   string  `db:"started_at" json:"startedAt"`
	}
	rows := []row{}
	_ = h.db.Select(&rows, `SELECT id, triggered_by, target_ip, stdout, exit_code, duration_ms,
	                              to_char(started_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at
	                       FROM dialing_rerun_history WHERE dialing_task_id=$1
	                       ORDER BY started_at DESC LIMIT 20`, id)
	c.JSON(http.StatusOK, rows)
}

// SyncDialingTasks POST /dialing/sync  手动触发一次全量同步
func (h *Handler) SyncDialingTasks(c *gin.Context) {
	if h.dialing == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "dialing service disabled"})
		return
	}
	if err := h.dialing.SyncAll(c.Request.Context()); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// BuildRerunCommand GET /dialing/tasks/:id/rerun-command
// 返回可复制的复测命令 + 目标 IP + 堡垒机链接
func (h *Handler) BuildRerunCommand(c *gin.Context) {
	id := c.Param("id")
	configID := c.Query("config_id")

	var task struct {
		Name       string  `db:"dialing_task_name"`
		IP         *string `db:"monitor_point_ip"`
		PointName  *string `db:"monitor_point_name"`
	}
	if err := h.db.Get(&task, `SELECT dialing_task_name, monitor_point_ip, monitor_point_name
	                            FROM dialing_tasks WHERE dialing_task_id=$1`, id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	type configRow struct {
		Plugin  *string `db:"plugin_name"`
		URL     *string `db:"request_url"`
		Params  *string `db:"extend_params"`
	}
	q := `SELECT plugin_name, request_url, extend_params FROM dialing_task_configs WHERE dialing_task_id=$1`
	args := []interface{}{id}
	if configID != "" {
		q += " AND monitor_config_id=$2"
		args = append(args, configID)
	}
	q += " ORDER BY execution_order"
	rows := []configRow{}
	if err := h.db.Select(&rows, q, args...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	baseDir := h.cfg.Dialing.ScriptBaseDir
	if baseDir == "" {
		baseDir = "/data/server/desp-proxy/cmd"
	}
	bastionURL := h.cfg.Dialing.BastionURL
	if bastionURL == "" {
		bastionURL = "https://ebgoas.iflysec.com/#/login"
	}

	ip := ""
	if task.IP != nil {
		ip = *task.IP
	}

	type cmdItem struct {
		Plugin   string `json:"plugin"`
		URL      string `json:"url"`
		Params   string `json:"params"`
		Command  string `json:"command"`
		OneLiner string `json:"oneLiner"`
	}
	items := []cmdItem{}
	for _, r := range rows {
		p, u, pr := "", "", ""
		if r.Plugin != nil {
			p = *r.Plugin
		}
		if r.URL != nil {
			u = *r.URL
		}
		if r.Params != nil {
			pr = *r.Params
		}
		cmd := "cd " + baseDir + " && ./" + p + " " + u + " " + pr
		items = append(items, cmdItem{
			Plugin:   p,
			URL:      u,
			Params:   pr,
			Command:  cmd,
			OneLiner: cmd,
		})
	}

	result := gin.H{
		"taskName":    task.Name,
		"targetIp":    ip,
		"pointName":   deref(task.PointName),
		"scriptDir":   baseDir,
		"bastionUrl":  bastionURL,
		"commands":    items,
	}
	rawJSON, _ := json.Marshal(result)
	c.Data(http.StatusOK, "application/json; charset=utf-8", rawJSON)
}

// GetDialingSyncStatus GET /dialing/sync-status  返回最近一次同步的时间/成功/失败信息
func (h *Handler) GetDialingSyncStatus(c *gin.Context) {
	if h.dialing == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "dialing service disabled"})
		return
	}
	status, err := h.dialing.GetSyncStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

// GetDialingTokenStatus GET /dialing/token-status  返回 token 有效期状态（剩余天数/是否需刷新）
func (h *Handler) GetDialingTokenStatus(c *gin.Context) {
	if h.dialing == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "dialing service disabled"})
		return
	}
	status, err := h.dialing.GetTokenStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
