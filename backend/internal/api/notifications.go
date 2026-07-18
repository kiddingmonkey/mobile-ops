package api

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"mobile-ops/internal/clients"
)

func contextBackground() context.Context {
	return context.Background()
}

// NotificationWebhook 通知渠道配置
type NotificationWebhook struct {
	ID          int64     `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Type        string    `db:"type" json:"type"`
	WebhookURL  string    `db:"webhook_url" json:"webhook_url"`
	Secret      string    `db:"secret" json:"secret,omitempty"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	MinSeverity string    `db:"min_severity" json:"min_severity"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// ListNotificationWebhooks GET /api/v1/notifications/webhooks
func (h *Handler) ListNotificationWebhooks(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.QueryxContext(ctx,
		`SELECT id, name, type, webhook_url, secret, enabled, min_severity, created_by, created_at, updated_at
		 FROM notification_webhooks ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	out := []NotificationWebhook{}
	for rows.Next() {
		var w NotificationWebhook
		if err := rows.StructScan(&w); err == nil {
			// 密钥脱敏（前 4 位 + ****）
			if len(w.Secret) > 4 {
				w.Secret = w.Secret[:4] + "****"
			}
			out = append(out, w)
		}
	}
	c.JSON(200, out)
}

// CreateNotificationWebhook POST /api/v1/notifications/webhooks
func (h *Handler) CreateNotificationWebhook(c *gin.Context) {
	var body struct {
		Name        string `json:"name" binding:"required"`
		Type        string `json:"type"`
		WebhookURL  string `json:"webhook_url" binding:"required"`
		Secret      string `json:"secret"`
		Enabled     bool   `json:"enabled"`
		MinSeverity string `json:"min_severity"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if body.Type == "" {
		body.Type = "feishu"
	}
	if body.MinSeverity == "" {
		body.MinSeverity = "warning"
	}

	username, _ := c.Get("username")
	var id int64
	err := h.db.QueryRowxContext(c.Request.Context(),
		`INSERT INTO notification_webhooks (name, type, webhook_url, secret, enabled, min_severity, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		body.Name, body.Type, body.WebhookURL, body.Secret, body.Enabled, body.MinSeverity, toString(username),
	).Scan(&id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"id": id})
}

// UpdateNotificationWebhook PUT /api/v1/notifications/webhooks/:id
func (h *Handler) UpdateNotificationWebhook(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var body struct {
		Name        string  `json:"name"`
		WebhookURL  string  `json:"webhook_url"`
		Secret      *string `json:"secret"`
		Enabled     *bool   `json:"enabled"`
		MinSeverity string  `json:"min_severity"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// 只更新 secret 时非空的字段（避免脱敏值覆盖）
	setClauses := []string{"updated_at=NOW()"}
	args := []any{}
	argIdx := 1
	if body.Name != "" {
		setClauses = append(setClauses, "name=$"+strconv.Itoa(argIdx))
		args = append(args, body.Name)
		argIdx++
	}
	if body.WebhookURL != "" {
		setClauses = append(setClauses, "webhook_url=$"+strconv.Itoa(argIdx))
		args = append(args, body.WebhookURL)
		argIdx++
	}
	if body.Secret != nil {
		setClauses = append(setClauses, "secret=$"+strconv.Itoa(argIdx))
		args = append(args, *body.Secret)
		argIdx++
	}
	if body.Enabled != nil {
		setClauses = append(setClauses, "enabled=$"+strconv.Itoa(argIdx))
		args = append(args, *body.Enabled)
		argIdx++
	}
	if body.MinSeverity != "" {
		setClauses = append(setClauses, "min_severity=$"+strconv.Itoa(argIdx))
		args = append(args, body.MinSeverity)
		argIdx++
	}
	args = append(args, id)

	sql := "UPDATE notification_webhooks SET " + join(setClauses, ", ") + " WHERE id=$" + strconv.Itoa(argIdx)
	_, err := h.db.ExecContext(c.Request.Context(), sql, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// DeleteNotificationWebhook DELETE /api/v1/notifications/webhooks/:id
func (h *Handler) DeleteNotificationWebhook(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	_, err := h.db.ExecContext(c.Request.Context(),
		`DELETE FROM notification_webhooks WHERE id=$1`, id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// TestNotificationWebhook POST /api/v1/notifications/webhooks/:id/test
// 发送一条测试消息
func (h *Handler) TestNotificationWebhook(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ctx := c.Request.Context()
	var w NotificationWebhook
	err := h.db.QueryRowxContext(ctx,
		`SELECT id, name, type, webhook_url, secret, enabled, min_severity FROM notification_webhooks WHERE id=$1`,
		id).StructScan(&w)
	if err != nil {
		c.JSON(404, gin.H{"error": "webhook not found"})
		return
	}

	// 目前只支持飞书
	if w.Type != "feishu" {
		c.JSON(400, gin.H{"error": "type not supported: " + w.Type})
		return
	}
	client := clients.NewFeishuWebhookClient(w.WebhookURL, w.Secret)
	if err := client.SendAlertCard(clients.FeishuAlertCard{
		Title:     "CloudPilot 测试消息",
		Severity:  "info",
		Cluster:   "test-cluster",
		Namespace: "default",
		Resource:  "test-pod",
		Message:   "这是一条来自 CloudPilot 的测试告警消息。如果你看到这条消息，说明飞书 Webhook 配置成功！",
		Timestamp: time.Now(),
	}); err != nil {
		c.JSON(500, gin.H{"error": "send failed: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true, "message": "测试消息已发送，请检查飞书群"})
}

// SendAlertToWebhooks 内部函数：对所有启用的 webhook 发送告警
func (h *Handler) SendAlertToWebhooks(cluster, namespace, resource, severity, message string) {
	ctx2 := contextBackground()
	rows, err := h.db.QueryxContext(ctx2,
		`SELECT id, name, type, webhook_url, secret, min_severity FROM notification_webhooks WHERE enabled = TRUE`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var w NotificationWebhook
		if err := rows.StructScan(&w); err != nil {
			continue
		}
		// severity 过滤
		if !severityMeetsThreshold(severity, w.MinSeverity) {
			continue
		}

		go func(wh NotificationWebhook) {
			if wh.Type == "feishu" {
				client := clients.NewFeishuWebhookClient(wh.WebhookURL, wh.Secret)
				_ = client.SendAlertCard(clients.FeishuAlertCard{
					Title:     "CloudPilot 告警",
					Severity:  severity,
					Cluster:   cluster,
					Namespace: namespace,
					Resource:  resource,
					Message:   message,
					Timestamp: time.Now(),
				})
			}
		}(w)
	}
}

func severityMeetsThreshold(severity, threshold string) bool {
	weight := map[string]int{"info": 1, "warning": 2, "critical": 3}
	return weight[severity] >= weight[threshold]
}

func join(items []string, sep string) string {
	if len(items) == 0 {
		return ""
	}
	out := items[0]
	for _, s := range items[1:] {
		out += sep + s
	}
	return out
}
