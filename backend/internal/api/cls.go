package api

import (
	"time"

	"github.com/gin-gonic/gin"
)

// ============ CLS 日志服务 ============

// ListCLSLogsets GET /api/v1/cls/regions/:region/logsets
func (h *Handler) ListCLSLogsets(c *gin.Context) {
	region := c.Param("region")
	if region == "" {
		c.JSON(400, gin.H{"error": "region is required"})
		return
	}

	// 获取第一个云账号（TODO: 支持多账号选择）
	accounts, err := h.config.ListCloudAccounts(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get cloud accounts: " + err.Error()})
		return
	}
	if len(accounts) == 0 {
		c.JSON(404, gin.H{"error": "no cloud account configured, please add one in settings"})
		return
	}

	account := accounts[0]
	// 解密 AK/SK
	secretID, err := h.cipher.Decrypt(account.SecretIDEncrypted)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to decrypt secret_id: " + err.Error()})
		return
	}
	secretKey, err := h.cipher.Decrypt(account.SecretKeyEncrypted)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to decrypt secret_key: " + err.Error()})
		return
	}

	clsClient := h.config.NewCLSClient(secretID, secretKey, region)

	logsets, err := clsClient.ListLogsets(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to list logsets: " + err.Error()})
		return
	}

	c.JSON(200, logsets)
}

// SearchCLSLogs POST /api/v1/cls/search
// Body: { "region": "ap-guangzhou", "logset_id": "xxx", "topic_id": "xxx", "query": "keyword", "start_time": "2024-01-01T00:00:00Z", "end_time": "2024-01-01T23:59:59Z", "limit": 100 }
func (h *Handler) SearchCLSLogs(c *gin.Context) {
	var req struct {
		Region    string `json:"region" binding:"required"`
		LogsetID  string `json:"logset_id"`
		TopicID   string `json:"topic_id"`
		Query     string `json:"query" binding:"required"`
		StartTime string `json:"start_time"`
		EndTime   string `json:"end_time"`
		Limit     int    `json:"limit"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	// 解析时间范围，默认最近 1 小时
	var startTime, endTime time.Time
	if req.StartTime != "" {
		var err error
		startTime, err = time.Parse(time.RFC3339, req.StartTime)
		if err != nil {
			c.JSON(400, gin.H{"error": "invalid start_time format, use RFC3339"})
			return
		}
	} else {
		startTime = time.Now().Add(-1 * time.Hour)
	}

	if req.EndTime != "" {
		var err error
		endTime, err = time.Parse(time.RFC3339, req.EndTime)
		if err != nil {
			c.JSON(400, gin.H{"error": "invalid end_time format, use RFC3339"})
			return
		}
	} else {
		endTime = time.Now()
	}

	if req.Limit == 0 {
		req.Limit = 100
	}
	if req.Limit > 1000 {
		req.Limit = 1000
	}

	// 获取云账号
	accounts, err := h.config.ListCloudAccounts(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get cloud accounts: " + err.Error()})
		return
	}
	if len(accounts) == 0 {
		c.JSON(404, gin.H{"error": "no cloud account configured"})
		return
	}

	account := accounts[0]
	secretID, err := h.cipher.Decrypt(account.SecretIDEncrypted)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to decrypt secret_id: " + err.Error()})
		return
	}
	secretKey, err := h.cipher.Decrypt(account.SecretKeyEncrypted)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to decrypt secret_key: " + err.Error()})
		return
	}

	clsClient := h.config.NewCLSClient(secretID, secretKey, req.Region)

	// 如果没有指定 topic_id，先列出所有 topic
	topicID := req.TopicID
	if topicID == "" && req.LogsetID != "" {
		topics, err := clsClient.ListTopics(c.Request.Context(), req.LogsetID)
		if err != nil {
			c.JSON(500, gin.H{"error": "failed to list topics: " + err.Error()})
			return
		}
		if len(topics) == 0 {
			c.JSON(404, gin.H{"error": "no topics found in this logset"})
			return
		}
		// 使用第一个 topic
		topicID = topics[0].ID
	}

	if topicID == "" {
		c.JSON(400, gin.H{"error": "topic_id or logset_id is required"})
		return
	}

	// 搜索日志
	logs, err := clsClient.SearchLogs(c.Request.Context(), topicID, req.Query, startTime, endTime, req.Limit)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to search logs: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"logs":       logs,
		"total":      len(logs),
		"start_time": startTime.Format(time.RFC3339),
		"end_time":   endTime.Format(time.RFC3339),
		"query":      req.Query,
		"topic_id":   topicID,
	})
}

// ListCLSTopics GET /api/v1/cls/regions/:region/logsets/:logset_id/topics
func (h *Handler) ListCLSTopics(c *gin.Context) {
	region := c.Param("region")
	logsetID := c.Param("logset_id")

	if region == "" || logsetID == "" {
		c.JSON(400, gin.H{"error": "region and logset_id are required"})
		return
	}

	accounts, err := h.config.ListCloudAccounts(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get cloud accounts: " + err.Error()})
		return
	}
	if len(accounts) == 0 {
		c.JSON(404, gin.H{"error": "no cloud account configured"})
		return
	}

	account := accounts[0]
	secretID, err := h.cipher.Decrypt(account.SecretIDEncrypted)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to decrypt secret_id: " + err.Error()})
		return
	}
	secretKey, err := h.cipher.Decrypt(account.SecretKeyEncrypted)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to decrypt secret_key: " + err.Error()})
		return
	}

	clsClient := h.config.NewCLSClient(secretID, secretKey, region)

	topics, err := clsClient.ListTopics(c.Request.Context(), logsetID)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to list topics: " + err.Error()})
		return
	}

	c.JSON(200, topics)
}
