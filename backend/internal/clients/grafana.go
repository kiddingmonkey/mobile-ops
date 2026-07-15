package clients

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// GrafanaClient 直连内网 Grafana，绕开阿里云 WAF
type GrafanaClient struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewGrafanaClient(baseURL, token string) *GrafanaClient {
	return &GrafanaClient{
		baseURL: baseURL,
		token:   token,
		http: &http.Client{
			Timeout: 8 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        20,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     30 * time.Second,
			},
		},
	}
}

func (c *GrafanaClient) do(ctx context.Context, method, path string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("grafana %s %s: HTTP %d", method, path, resp.StatusCode)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

type Dashboard struct {
	Meta struct {
		Slug string `json:"slug"`
		URL  string `json:"url"`
	} `json:"meta"`
	Dashboard struct {
		UID    string        `json:"uid"`
		Title  string        `json:"title"`
		Panels []interface{} `json:"panels"`
	} `json:"dashboard"`
}

func (c *GrafanaClient) GetDashboard(ctx context.Context, uid string) (*Dashboard, error) {
	var d Dashboard
	if err := c.do(ctx, "GET", "/api/dashboards/uid/"+uid, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

// RenderPanelURL 生成 kiosk 模式的 iframe URL
// PWA 前端可以直接嵌入这个 URL 显示面板
func (c *GrafanaClient) RenderPanelURL(dashUID, slug string, panelID int, from, to string, vars map[string]string) string {
	q := url.Values{}
	q.Set("orgId", "1")
	q.Set("panelId", fmt.Sprintf("%d", panelID))
	q.Set("from", from)
	q.Set("to", to)
	q.Set("theme", "dark")
	q.Set("kiosk", "1")
	for k, v := range vars {
		q.Set("var-"+k, v)
	}
	return fmt.Sprintf("%s/d-solo/%s/%s?%s", c.baseURL, dashUID, slug, q.Encode())
}

// RenderPanelPNG 服务端渲染 PNG（需要 Grafana 装了 renderer 插件）
func (c *GrafanaClient) RenderPanelPNG(dashUID, slug string, panelID int, width, height int, from, to string, vars map[string]string) string {
	q := url.Values{}
	q.Set("orgId", "1")
	q.Set("panelId", fmt.Sprintf("%d", panelID))
	q.Set("width", fmt.Sprintf("%d", width))
	q.Set("height", fmt.Sprintf("%d", height))
	q.Set("from", from)
	q.Set("to", to)
	q.Set("theme", "dark")
	for k, v := range vars {
		q.Set("var-"+k, v)
	}
	return fmt.Sprintf("%s/render/d-solo/%s/%s?%s", c.baseURL, dashUID, slug, q.Encode())
}

// FetchPanelPNG 抓取渲染好的 PNG 字节（后端代理用）
// theme 可传 "dark" / "light"
func (c *GrafanaClient) FetchPanelPNG(ctx context.Context, dashUID string, panelID int, width, height int, from, to, theme string, vars map[string]string) ([]byte, string, error) {
	if theme == "" {
		theme = "dark"
	}
	// slug 可以随便填一个占位，Grafana 只用 uid 定位
	q := url.Values{}
	q.Set("orgId", "1")
	q.Set("panelId", fmt.Sprintf("%d", panelID))
	q.Set("width", fmt.Sprintf("%d", width))
	q.Set("height", fmt.Sprintf("%d", height))
	q.Set("from", from)
	q.Set("to", to)
	q.Set("theme", theme)
	q.Set("timeout", "30")
	for k, v := range vars {
		if v != "" {
			q.Set("var-"+k, v)
		}
	}
	renderURL := fmt.Sprintf("%s/render/d-solo/%s/mobile?%s", c.baseURL, dashUID, q.Encode())

	req, err := http.NewRequestWithContext(ctx, "GET", renderURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	// 渲染可能慢，单独一个长 timeout 的 http client
	httpCli := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpCli.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, "", fmt.Errorf("grafana render HTTP %d: %s", resp.StatusCode, string(body[:min(len(body), 300)]))
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/png"
	}
	return body, ct, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (c *GrafanaClient) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("grafana health HTTP %d", resp.StatusCode)
	}
	return nil
}
