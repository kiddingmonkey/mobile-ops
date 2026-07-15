package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

type Config struct {
	Server            ServerConfig            `mapstructure:"server"`
	Database          DatabaseConfig          `mapstructure:"database"`
	Security          SecurityConfig          `mapstructure:"security"`
	GrafanaDefault    GrafanaSourceConfig     `mapstructure:"grafana_default"`
	PrometheusDefault PrometheusSourceConfig  `mapstructure:"prometheus_default"`
	AlertManager      AlertManagerConfig      `mapstructure:"alertmanager"`
	Policy            PolicyConfig            `mapstructure:"policy"`
}

type ServerConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	Mode         string `mapstructure:"mode"`
	ReadTimeout  int    `mapstructure:"read_timeout"`
	WriteTimeout int    `mapstructure:"write_timeout"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"dbname"`
	SSLMode  string `mapstructure:"sslmode"`
	MaxOpen  int    `mapstructure:"max_open"`
	MaxIdle  int    `mapstructure:"max_idle"`
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode)
}

type SecurityConfig struct {
	EncryptionKey string `mapstructure:"encryption_key"`
	JWTSecret     string `mapstructure:"jwt_secret"`
	JWTTTLHours   int    `mapstructure:"jwt_ttl_hours"`
}

type GrafanaSourceConfig struct {
	Enabled bool   `mapstructure:"enabled"`
	URL     string `mapstructure:"url"`
	Token   string `mapstructure:"token"`
}

type PrometheusSourceConfig struct {
	Enabled  bool   `mapstructure:"enabled"`
	URL      string `mapstructure:"url"`
	AuthType string `mapstructure:"auth_type"`
}

type AlertManagerConfig struct {
	WebhookPath string `mapstructure:"webhook_path"`
}

type PolicyConfig struct {
	ScaleDebounceMinutes      int `mapstructure:"scale_debounce_minutes"`
	ReadyPollTimeoutMinutes   int `mapstructure:"ready_poll_timeout_minutes"`
	ReadyPollIntervalSeconds  int `mapstructure:"ready_poll_interval_seconds"`
	MetricFreshnessSeconds    int `mapstructure:"metric_freshness_seconds"`
}

func Load(path string) (*Config, error) {
	viper.SetConfigFile(path)
	viper.AutomaticEnv()
	viper.SetEnvPrefix("MOBILEOPS")

	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	// 环境变量覆盖敏感配置
	if v := os.Getenv("MOBILEOPS_ENCRYPTION_KEY"); v != "" {
		cfg.Security.EncryptionKey = v
	}
	if v := os.Getenv("MOBILEOPS_JWT_SECRET"); v != "" {
		cfg.Security.JWTSecret = v
	}
	if v := os.Getenv("MOBILEOPS_DB_PASSWORD"); v != "" {
		cfg.Database.Password = v
	}

	if len(cfg.Security.EncryptionKey) != 32 {
		return nil, fmt.Errorf("encryption_key 必须是 32 字节 (当前 %d)", len(cfg.Security.EncryptionKey))
	}

	return &cfg, nil
}
