package clients

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// PromClient 支持标准 Prometheus 和 VictoriaMetrics 兼容路径
type PromClient struct {
	baseURL  string
	authType string
	auth     string
	http     *http.Client
}

func NewPromClient(baseURL, authType, auth string) *PromClient {
	return &PromClient{
		baseURL:  baseURL,
		authType: authType,
		auth:     auth,
		http: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

type PromResult struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string          `json:"resultType"`
		Result     []PromSeries    `json:"result"`
	} `json:"data"`
	Error     string `json:"error,omitempty"`
	ErrorType string `json:"errorType,omitempty"`
}

type PromSeries struct {
	Metric map[string]string `json:"metric"`
	Value  []interface{}     `json:"value,omitempty"`   // instant: [timestamp, value]
	Values [][]interface{}   `json:"values,omitempty"`  // range: [[ts,val], ...]
}

func (c *PromClient) applyAuth(req *http.Request) {
	switch c.authType {
	case "basic":
		// auth format: "user:pass"
		req.Header.Set("Authorization", "Basic "+c.auth)
	case "bearer":
		req.Header.Set("Authorization", "Bearer "+c.auth)
	}
}

func (c *PromClient) Query(ctx context.Context, query string) (*PromResult, error) {
	q := url.Values{}
	q.Set("query", query)
	return c.doQuery(ctx, "/api/v1/query?"+q.Encode())
}

func (c *PromClient) QueryAt(ctx context.Context, query string, at time.Time) (*PromResult, error) {
	q := url.Values{}
	q.Set("query", query)
	q.Set("time", strconv.FormatInt(at.Unix(), 10))
	return c.doQuery(ctx, "/api/v1/query?"+q.Encode())
}

func (c *PromClient) QueryRange(ctx context.Context, query string, start, end time.Time, step time.Duration) (*PromResult, error) {
	q := url.Values{}
	q.Set("query", query)
	q.Set("start", strconv.FormatInt(start.Unix(), 10))
	q.Set("end", strconv.FormatInt(end.Unix(), 10))
	q.Set("step", fmt.Sprintf("%.0fs", step.Seconds()))
	return c.doQuery(ctx, "/api/v1/query_range?"+q.Encode())
}

func (c *PromClient) doQuery(ctx context.Context, path string) (*PromResult, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("prom HTTP %d", resp.StatusCode)
	}
	var r PromResult
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	if r.Status != "success" {
		return nil, fmt.Errorf("prom %s: %s", r.ErrorType, r.Error)
	}
	return &r, nil
}

// LabelValues 拉某个 label 的所有值（如 job/instance/cluster）
func (c *PromClient) LabelValues(ctx context.Context, label string) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/label/"+label+"/values", nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var r struct {
		Status string   `json:"status"`
		Data   []string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	return r.Data, nil
}

func (c *PromClient) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/-/healthy", nil)
	if err != nil {
		return err
	}
	c.applyAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("prom health HTTP %d", resp.StatusCode)
	}
	return nil
}
