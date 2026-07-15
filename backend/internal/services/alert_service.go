package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jmoiron/sqlx"
)

// AlertService 处理 AlertManager 回调的告警
type AlertService struct {
	db *sqlx.DB
}

func NewAlertService(db *sqlx.DB) *AlertService {
	return &AlertService{db: db}
}

// AlertManagerPayload 对应 alertmanager webhook 4.x 格式
type AlertManagerPayload struct {
	Version           string            `json:"version"`
	GroupKey          string            `json:"groupKey"`
	Status            string            `json:"status"`   // firing/resolved
	Receiver          string            `json:"receiver"`
	GroupLabels       map[string]string `json:"groupLabels"`
	CommonLabels      map[string]string `json:"commonLabels"`
	CommonAnnotations map[string]string `json:"commonAnnotations"`
	ExternalURL       string            `json:"externalURL"`
	Alerts            []AlertItem       `json:"alerts"`
}

type AlertItem struct {
	Status       string            `json:"status"`
	Labels       map[string]string `json:"labels"`
	Annotations  map[string]string `json:"annotations"`
	StartsAt     time.Time         `json:"startsAt"`
	EndsAt       time.Time         `json:"endsAt"`
	GeneratorURL string            `json:"generatorURL"`
	Fingerprint  string            `json:"fingerprint"`
}

func (s *AlertService) Ingest(ctx context.Context, p *AlertManagerPayload) error {
	for _, a := range p.Alerts {
		labelsJSON, _ := json.Marshal(a.Labels)
		annJSON, _ := json.Marshal(a.Annotations)
		severity := a.Labels["severity"]
		if severity == "" {
			severity = "info"
		}
		alertname := a.Labels["alertname"]
		summary := a.Annotations["summary"]
		description := a.Annotations["description"]

		var endsAt interface{}
		if !a.EndsAt.IsZero() && a.Status == "resolved" {
			endsAt = a.EndsAt
		}

		_, err := s.db.ExecContext(ctx,
			`INSERT INTO alerts_cache (fingerprint, severity, alertname, summary, description,
			 labels, annotations, status, starts_at, ends_at, received_at)
			 VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,NOW())
			 ON CONFLICT (fingerprint) DO UPDATE SET
			   status = EXCLUDED.status,
			   ends_at = EXCLUDED.ends_at,
			   received_at = NOW()`,
			a.Fingerprint, severity, alertname, summary, description,
			string(labelsJSON), string(annJSON), a.Status, a.StartsAt, endsAt)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *AlertService) List(ctx context.Context, limit int) ([]AlertRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	var out []AlertRow
	err := s.db.SelectContext(ctx, &out,
		`SELECT id, fingerprint, severity, alertname, summary, description,
		 status, starts_at, ends_at, received_at
		 FROM alerts_cache ORDER BY starts_at DESC LIMIT $1`, limit)
	return out, err
}

type AlertRow struct {
	ID          int64      `db:"id" json:"id"`
	Fingerprint string     `db:"fingerprint" json:"fingerprint"`
	Severity    string     `db:"severity" json:"severity"`
	AlertName   string     `db:"alertname" json:"alertname"`
	Summary     *string    `db:"summary" json:"summary,omitempty"`
	Description *string    `db:"description" json:"description,omitempty"`
	Status      string     `db:"status" json:"status"`
	StartsAt    time.Time  `db:"starts_at" json:"starts_at"`
	EndsAt      *time.Time `db:"ends_at" json:"ends_at,omitempty"`
	ReceivedAt  time.Time  `db:"received_at" json:"received_at"`
}
