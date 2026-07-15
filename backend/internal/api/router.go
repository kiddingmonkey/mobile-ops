package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"mobile-ops/internal/config"
	"mobile-ops/internal/middleware"
	"mobile-ops/internal/services"
)

type Handler struct {
	db      *sqlx.DB
	cfg     *config.Config
	auth    *services.AuthService
	config  *services.ConfigService
	scale   *services.ScaleService
	alert   *services.AlertService
}

func NewHandler(db *sqlx.DB, cfg *config.Config, auth *services.AuthService,
	configSvc *services.ConfigService, scale *services.ScaleService, alert *services.AlertService) *Handler {
	return &Handler{db: db, cfg: cfg, auth: auth, config: configSvc, scale: scale, alert: alert}
}

func (h *Handler) Register(r *gin.Engine) {
	r.Use(middleware.CORS())

	r.GET("/api/v1/health", h.Health)

	// 公开接口
	r.POST("/api/v1/auth/login", h.Login)
	r.POST(h.cfg.AlertManager.WebhookPath, h.AlertWebhook)

	// 鉴权接口
	priv := r.Group("/api/v1")
	priv.Use(middleware.RequireAuth(h.auth))
	{
		priv.GET("/me", h.Me)

		// 配置管理
		priv.GET("/grafana-sources", h.ListGrafanaSources)
		priv.POST("/grafana-sources", h.CreateGrafanaSource)
		priv.DELETE("/grafana-sources/:id", h.DeleteGrafanaSource)

		priv.GET("/prom-sources", h.ListPromSources)
		priv.POST("/prom-sources", h.CreatePromSource)

		priv.GET("/cloud-accounts", h.ListCloudAccounts)
		priv.POST("/cloud-accounts", h.CreateCloudAccount)

		priv.GET("/clusters", h.ListClusters)
		priv.POST("/clusters", h.CreateCluster)
		priv.GET("/clusters/:id", h.GetCluster)
		priv.PUT("/clusters/:id", h.UpdateCluster)
		priv.DELETE("/clusters/:id", h.DeleteCluster)
		priv.POST("/clusters/:id/sync", h.SyncCluster)
		priv.GET("/clusters/:id/overview", h.ClusterOverview)

		priv.GET("/clusters/:id/node-pools", h.ListNodePools)
		priv.GET("/clusters/:id/metrics", h.ClusterMetrics)
		priv.GET("/clusters/:id/grafana/panel", h.GrafanaPanel)
		priv.GET("/clusters/:id/grafana/dashboards", h.GrafanaDashboards)

		// 扩容
		priv.POST("/scale/precheck", h.ScalePrecheck)
		priv.POST("/scale/submit", h.ScaleSubmit)

		// 操作日志
		priv.GET("/operations", h.ListOperations)
		priv.GET("/operations/:opid", h.GetOperation)

		// 告警
		priv.GET("/alerts", h.ListAlerts)

		// 快捷指令
		priv.GET("/shortcuts", h.ListShortcuts)
		priv.POST("/shortcuts", h.CreateShortcut)
		priv.DELETE("/shortcuts/:id", h.DeleteShortcut)
	}
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
