package clients

import (
	"context"
	"time"
)

// VMClient is a wrapper around PromClient for VictoriaMetrics
// VM API is compatible with Prometheus HTTP API
type VMClient struct {
	*PromClient
}

func NewVMClient(baseURL string) *VMClient {
	return &VMClient{
		PromClient: NewPromClient(baseURL, "none", ""),
	}
}

// Query executes an instant query (same as Prometheus)
func (c *VMClient) Query(ctx context.Context, query string) (*PromResult, error) {
	return c.PromClient.Query(ctx, query)
}

// QueryRange executes a range query (same as Prometheus)
func (c *VMClient) QueryRange(ctx context.Context, query string, start, end time.Time, step time.Duration) (*PromResult, error) {
	return c.PromClient.QueryRange(ctx, query, start, end, step)
}
