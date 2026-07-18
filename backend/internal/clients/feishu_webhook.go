package clients

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// FeishuWebhookClient 飞书群机器人客户端
type FeishuWebhookClient struct {
	WebhookURL string
	Secret     string
}

// NewFeishuWebhookClient 创建飞书 Webhook 客户端
func NewFeishuWebhookClient(url, secret string) *FeishuWebhookClient {
	return &FeishuWebhookClient{WebhookURL: url, Secret: secret}
}

// SendText 发送纯文本消息
func (c *FeishuWebhookClient) SendText(text string) error {
	payload := map[string]any{
		"msg_type": "text",
		"content":  map[string]string{"text": text},
	}
	return c.send(payload)
}

// FeishuAlertCard 告警卡片参数
type FeishuAlertCard struct {
	Title       string
	Severity    string // info/warning/critical
	Cluster     string
	Namespace   string
	Resource    string // 资源名（Pod / Deployment 等）
	Message     string
	Timestamp   time.Time
	DetailLink  string // 可选：APP 深链或 Web 链接
}

// SendAlertCard 发送告警卡片（飞书交互卡片）
func (c *FeishuWebhookClient) SendAlertCard(card FeishuAlertCard) error {
	// 颜色 / emoji 按 severity 区分
	color := "blue"
	emoji := "🔵"
	switch card.Severity {
	case "critical":
		color = "red"
		emoji = "🔴"
	case "warning":
		color = "orange"
		emoji = "⚠️"
	case "info":
		color = "blue"
		emoji = "ℹ️"
	}

	title := card.Title
	if title == "" {
		title = "CloudPilot 告警"
	}

	elements := []map[string]any{
		{
			"tag": "div",
			"fields": []map[string]any{
				{"is_short": true, "text": map[string]any{"tag": "lark_md", "content": fmt.Sprintf("**集群**\n%s", card.Cluster)}},
				{"is_short": true, "text": map[string]any{"tag": "lark_md", "content": fmt.Sprintf("**命名空间**\n%s", card.Namespace)}},
				{"is_short": true, "text": map[string]any{"tag": "lark_md", "content": fmt.Sprintf("**资源**\n%s", card.Resource)}},
				{"is_short": true, "text": map[string]any{"tag": "lark_md", "content": fmt.Sprintf("**级别**\n%s %s", emoji, card.Severity)}},
			},
		},
		{
			"tag": "div",
			"text": map[string]any{
				"tag":     "lark_md",
				"content": fmt.Sprintf("**详情**\n%s", card.Message),
			},
		},
		{
			"tag": "hr",
		},
		{
			"tag": "note",
			"elements": []map[string]any{
				{"tag": "plain_text", "content": fmt.Sprintf("⏰ %s | CloudPilot 云驾", card.Timestamp.Format("2006-01-02 15:04:05"))},
			},
		},
	}

	if card.DetailLink != "" {
		elements = append(elements, map[string]any{
			"tag": "action",
			"actions": []map[string]any{
				{
					"tag":  "button",
					"text": map[string]any{"tag": "plain_text", "content": "查看详情"},
					"type": "primary",
					"url":  card.DetailLink,
				},
			},
		})
	}

	payload := map[string]any{
		"msg_type": "interactive",
		"card": map[string]any{
			"config": map[string]any{"wide_screen_mode": true},
			"header": map[string]any{
				"template": color,
				"title": map[string]any{
					"tag":     "plain_text",
					"content": fmt.Sprintf("%s %s", emoji, title),
				},
			},
			"elements": elements,
		},
	}

	return c.send(payload)
}

// send 发送消息（带签名）
func (c *FeishuWebhookClient) send(payload map[string]any) error {
	// 飞书签名（如果配置了 secret）
	if c.Secret != "" {
		ts := strconv.FormatInt(time.Now().Unix(), 10)
		sign, err := genFeishuSign(ts, c.Secret)
		if err != nil {
			return fmt.Errorf("gen sign: %w", err)
		}
		payload["timestamp"] = ts
		payload["sign"] = sign
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("POST", c.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("post: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("feishu resp %d: %s", resp.StatusCode, string(respBody))
	}

	// 飞书业务错误码
	var r struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	}
	if err := json.Unmarshal(respBody, &r); err == nil && r.Code != 0 {
		return fmt.Errorf("feishu code=%d msg=%s", r.Code, r.Msg)
	}

	return nil
}

// genFeishuSign 生成飞书签名（HMAC-SHA256）
func genFeishuSign(timestamp, secret string) (string, error) {
	// 拼接字符串: timestamp + "\n" + secret
	stringToSign := timestamp + "\n" + secret
	h := hmac.New(sha256.New, []byte(stringToSign))
	if _, err := h.Write([]byte("")); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(h.Sum(nil)), nil
}
