package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

type User struct {
	ID           int64      `db:"id" json:"id"`
	Username     string     `db:"username" json:"username"`
	PasswordHash string     `db:"password_hash" json:"-"`
	DisplayName  *string    `db:"display_name" json:"display_name,omitempty"`
	Email        *string    `db:"email" json:"email,omitempty"`
	Role         string     `db:"role" json:"role"`
	LastLoginAt  *time.Time `db:"last_login_at" json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
}

type GrafanaSource struct {
	ID             int64     `db:"id" json:"id"`
	Name           string    `db:"name" json:"name"`
	URL            string    `db:"url" json:"url"`
	TokenEncrypted []byte    `db:"token_encrypted" json:"-"`
	IsDefault      bool      `db:"is_default" json:"is_default"`
	CreatedBy      *int64    `db:"created_by" json:"created_by,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

type PrometheusSource struct {
	ID             int64     `db:"id" json:"id"`
	Name           string    `db:"name" json:"name"`
	URL            string    `db:"url" json:"url"`
	AuthType       string    `db:"auth_type" json:"auth_type"`
	AuthEncrypted  []byte    `db:"auth_encrypted" json:"-"`
	IsDefault      bool      `db:"is_default" json:"is_default"`
	CreatedBy      *int64    `db:"created_by" json:"created_by,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

type VictoriaMetricsSource struct {
	ID          int64     `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	URL         string    `db:"url" json:"url"`
	Description *string   `db:"description" json:"description,omitempty"`
	IsDefault   bool      `db:"is_default" json:"is_default"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CloudAccount struct {
	ID                  int64     `db:"id" json:"id"`
	Name                string    `db:"name" json:"name"`
	Provider            string    `db:"provider" json:"provider"`
	Region              string    `db:"region" json:"region"`
	SecretIDEncrypted   []byte    `db:"secret_id_encrypted" json:"-"`
	SecretKeyEncrypted  []byte    `db:"secret_key_encrypted" json:"-"`
	CreatedBy           *int64    `db:"created_by" json:"created_by,omitempty"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
}

type Cluster struct {
	ID                    int64          `db:"id" json:"id"`
	Name                  string         `db:"name" json:"name"`
	DisplayName           *string        `db:"display_name" json:"display_name,omitempty"`
	Provider              string         `db:"provider" json:"provider"`
	ProviderClusterID     *string        `db:"provider_cluster_id" json:"provider_cluster_id,omitempty"`
	Region                *string        `db:"region" json:"region,omitempty"`
	CloudAccountID        *int64         `db:"cloud_account_id" json:"cloud_account_id,omitempty"`
	KubeconfigEncrypted   []byte         `db:"kubeconfig_encrypted" json:"-"`
	GrafanaSourceID       *int64         `db:"grafana_source_id" json:"grafana_source_id,omitempty"`
	GrafanaClusterVar     *string        `db:"grafana_cluster_var" json:"grafana_cluster_var,omitempty"`
	PromSourceID          *int64         `db:"prom_source_id" json:"prom_source_id,omitempty"`
	Status                string         `db:"status" json:"status"`
	CreatedBy             *int64         `db:"created_by" json:"created_by,omitempty"`
	CreatedAt             time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt             time.Time      `db:"updated_at" json:"updated_at"`
}

type NodePool struct {
	ID              int64           `db:"id" json:"id"`
	ClusterID       int64           `db:"cluster_id" json:"cluster_id"`
	Name            string          `db:"name" json:"name"`
	ProviderPoolID  *string         `db:"provider_pool_id" json:"provider_pool_id,omitempty"`
	MinSize         int             `db:"min_size" json:"min_size"`
	MaxSize         int             `db:"max_size" json:"max_size"`
	DesiredSize     sql.NullInt32   `db:"desired_size" json:"desired_size,omitempty"`
	CurrentSize     sql.NullInt32   `db:"current_size" json:"current_size,omitempty"`
	InstanceType    *string         `db:"instance_type" json:"instance_type,omitempty"`
	CostPerHour     *float64        `db:"cost_per_hour" json:"cost_per_hour,omitempty"`
	Labels          json.RawMessage `db:"labels" json:"labels"`
	Taints          json.RawMessage `db:"taints" json:"taints"`
	LastSyncedAt    *time.Time      `db:"last_synced_at" json:"last_synced_at,omitempty"`
}

type Operation struct {
	ID              int64           `db:"id" json:"id"`
	OperationID     string          `db:"operation_id" json:"operation_id"`
	UserID          *int64          `db:"user_id" json:"user_id,omitempty"`
	ClusterID       *int64          `db:"cluster_id" json:"cluster_id,omitempty"`
	NodePoolID      *int64          `db:"node_pool_id" json:"node_pool_id,omitempty"`
	Action          string          `db:"action" json:"action"`
	Delta           *int            `db:"delta" json:"delta,omitempty"`
	TargetSize      *int            `db:"target_size" json:"target_size,omitempty"`
	Status          string          `db:"status" json:"status"`
	PrecheckResult  json.RawMessage `db:"precheck_result" json:"precheck_result,omitempty"`
	TriggerSource   *string         `db:"trigger_source" json:"trigger_source,omitempty"`
	AlertRef        *string         `db:"alert_ref" json:"alert_ref,omitempty"`
	ErrorMsg        *string         `db:"error_msg" json:"error_msg,omitempty"`
	StartedAt       time.Time       `db:"started_at" json:"started_at"`
	FinishedAt      *time.Time      `db:"finished_at" json:"finished_at,omitempty"`
	Metadata        json.RawMessage `db:"metadata" json:"metadata,omitempty"`
}

type Alert struct {
	ID           int64           `db:"id" json:"id"`
	Fingerprint  string          `db:"fingerprint" json:"fingerprint"`
	ClusterID    *int64          `db:"cluster_id" json:"cluster_id,omitempty"`
	Severity     string          `db:"severity" json:"severity"`
	AlertName    string          `db:"alertname" json:"alertname"`
	Summary      *string         `db:"summary" json:"summary,omitempty"`
	Description  *string         `db:"description" json:"description,omitempty"`
	Labels       json.RawMessage `db:"labels" json:"labels"`
	Annotations  json.RawMessage `db:"annotations" json:"annotations"`
	Status       string          `db:"status" json:"status"`
	StartsAt     *time.Time      `db:"starts_at" json:"starts_at,omitempty"`
	EndsAt       *time.Time      `db:"ends_at" json:"ends_at,omitempty"`
	ReceivedAt   time.Time       `db:"received_at" json:"received_at"`
}

type Shortcut struct {
	ID          int64     `db:"id" json:"id"`
	UserID      int64     `db:"user_id" json:"user_id"`
	Name        string    `db:"name" json:"name"`
	ClusterID   *int64    `db:"cluster_id" json:"cluster_id,omitempty"`
	NodePoolID  *int64    `db:"node_pool_id" json:"node_pool_id,omitempty"`
	Action      string    `db:"action" json:"action"`
	Delta       *int      `db:"delta" json:"delta,omitempty"`
	Icon        string    `db:"icon" json:"icon"`
	SortOrder   int       `db:"sort_order" json:"sort_order"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

type SecurityGroupWhitelist struct {
	ID              int64      `db:"id" json:"id"`
	Name            string     `db:"name" json:"name"`
	CloudAccountID  int64      `db:"cloud_account_id" json:"cloud_account_id"`
	Region          string     `db:"region" json:"region"`
	SGID            string     `db:"sg_id" json:"sg_id"`
	Port            string     `db:"port" json:"port"`
	Protocol        string     `db:"protocol" json:"protocol"`
	Description     *string    `db:"description" json:"description,omitempty"`
	LastIP          *string    `db:"last_ip" json:"last_ip,omitempty"`
	LastUpdatedAt   *time.Time `db:"last_updated_at" json:"last_updated_at,omitempty"`
	CreatedBy       *int64     `db:"created_by" json:"created_by,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

type MetricsSnapshot struct {
	ID          int64           `db:"id" json:"id"`
	ClusterID   int64           `db:"cluster_id" json:"cluster_id"`
	SnapshotAt  time.Time       `db:"snapshot_at" json:"snapshot_at"`
	Metrics     json.RawMessage `db:"metrics" json:"metrics"`
	Source      string          `db:"source" json:"source"`
}
