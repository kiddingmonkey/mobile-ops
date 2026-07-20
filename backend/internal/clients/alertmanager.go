package clients

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// AlertmanagerClient 代理 Alertmanager API v2
type AlertmanagerClient struct {
	baseURL string
	http    *http.Client
}

func NewAlertmanagerClient(baseURL string) *AlertmanagerClient {
	return &AlertmanagerClient{
		baseURL: baseURL,
		http:    &http.Client{Timeout: 10 * time.Second},
	}
}

// Silence represents an Alertmanager silence
type Silence struct {
	ID        string            `json:"id,omitempty"`
	Matchers  []SilenceMatcher  `json:"matchers"`
	StartsAt  time.Time         `json:"startsAt"`
	EndsAt    time.Time         `json:"endsAt"`
	CreatedBy string            `json:"createdBy"`
	Comment   string            `json:"comment"`
	Status    *SilenceStatus    `json:"status,omitempty"`
}

type SilenceMatcher struct {
	Name    string `json:"name"`
	Value   string `json:"value"`
	IsRegex bool   `json:"isRegex"`
	IsEqual bool   `json:"isEqual"`
}

type SilenceStatus struct {
	State string `json:"state"` // active/pending/expired
}

// ListSilences GET /api/v2/silences
func (c *AlertmanagerClient) ListSilences(ctx context.Context) ([]Silence, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v2/silences", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("alertmanager API error %d: %s", resp.StatusCode, string(body))
	}
	var silences []Silence
	if err := json.NewDecoder(resp.Body).Decode(&silences); err != nil {
		return nil, err
	}
	return silences, nil
}

// CreateSilence POST /api/v2/silences
func (c *AlertmanagerClient) CreateSilence(ctx context.Context, silence *Silence) (string, error) {
	data, err := json.Marshal(silence)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v2/silences", bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("alertmanager API error %d: %s", resp.StatusCode, string(body))
	}
	var result struct {
		SilenceID string `json:"silenceID"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.SilenceID, nil
}

// DeleteSilence DELETE /api/v2/silence/:id
func (c *AlertmanagerClient) DeleteSilence(ctx context.Context, id string) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE", c.baseURL+"/api/v2/silence/"+id, nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("alertmanager API error %d: %s", resp.StatusCode, string(body))
	}
	return nil
}
