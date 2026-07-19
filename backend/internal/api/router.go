package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"mobile-ops/internal/config"
	"mobile-ops/internal/middleware"
	"mobile-ops/internal/services"
	"mobile-ops/internal/utils"
)

type Handler struct {
	db      *sqlx.DB
	cfg     *config.Config
	auth    *services.AuthService
	config  *services.ConfigService
	scale   *services.ScaleService
	alert   *services.AlertService
	cipher  *utils.Cipher
}

func NewHandler(db *sqlx.DB, cfg *config.Config, auth *services.AuthService,
	configSvc *services.ConfigService, scale *services.ScaleService, alert *services.AlertService, cipher *utils.Cipher) *Handler {
	return &Handler{db: db, cfg: cfg, auth: auth, config: configSvc, scale: scale, alert: alert, cipher: cipher}
}

func (h *Handler) Register(r *gin.Engine) {
	r.Use(middleware.CORS())

	r.GET("/api/v1/health", h.Health)

	// 公开接口
	r.POST("/api/v1/auth/login", h.Login)
	r.POST(h.cfg.AlertManager.WebhookPath, h.AlertWebhook)
	r.GET("/api/v1/version/latest", h.GetLatestVersion) // APK版本检查（无需登录）

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
		priv.GET("/clusters/:id/node-pools/:pool_id", h.GetNodePoolDetail)
		priv.GET("/clusters/:id/metrics", h.ClusterMetrics)
		priv.GET("/clusters/:id/grafana/panel", h.GrafanaPanel)
		priv.GET("/clusters/:id/grafana/dashboards", h.GrafanaDashboards)
		priv.GET("/clusters/:id/grafana/proxy/*path", h.GrafanaProxy)  // 通用 Grafana 代理

		// K8s 资源管理
		priv.GET("/clusters/:id/resources/:type", h.ListK8sResources)
		priv.GET("/clusters/:id/resources/:type/yaml", h.GetK8sResourceYAML)
		priv.GET("/clusters/:id/resources/:type/events", h.GetResourceEvents)

		// CRD & 通用资源（dynamic client）
		priv.GET("/clusters/:id/crds", h.ListCRDs)
		priv.GET("/clusters/:id/crds/:group/:version/:resource", h.ListCRDResources)
		priv.GET("/clusters/:id/crds/:group/:version/:resource/yaml", h.GetCRDResourceYAML)

		// YAML 编辑 + 回滚
		priv.PUT("/clusters/:id/resources/yaml", h.UpdateResourceYAML)
		priv.GET("/clusters/:id/resources/revisions", h.ListResourceRevisions)
		priv.GET("/clusters/:id/resources/revisions/:rev_id", h.GetResourceRevision)
		priv.POST("/clusters/:id/resources/revisions/:rev_id/rollback", h.RollbackToRevision)
		priv.DELETE("/clusters/:id/resources/delete", h.DeleteResource)

		// 工作负载快捷操作
		priv.POST("/clusters/:id/workloads/:kind/:namespace/:name/restart", h.RestartWorkload)
		priv.POST("/clusters/:id/workloads/:kind/:namespace/:name/scale", h.ScaleWorkload)
		priv.POST("/clusters/:id/workloads/:kind/:namespace/:name/scale-precheck", h.WorkloadScalePrecheck)
		priv.POST("/clusters/:id/deployments/:namespace/:name/pause", h.PauseDeployment)

		// SSE 实时事件流
		priv.GET("/clusters/:id/resources/:type/events/stream", h.StreamResourceEvents)
		priv.GET("/clusters/:id/namespaces/:namespace/events/stream", h.StreamNamespaceEvents)

		// SSE 资源列表状态实时推送
		priv.GET("/clusters/:id/resources/:type/watch", h.WatchResourceList)

		// Pod 相关
		priv.GET("/clusters/:id/namespaces", h.ListNamespaces)
		priv.GET("/clusters/:id/namespaces/:namespace/pods", h.ListPods)
		priv.GET("/clusters/:id/pods/:namespace/:name", h.GetPodDetail)
		priv.GET("/clusters/:id/pods/:namespace/:name/events", h.ListPodEvents)
		priv.GET("/clusters/:id/pods/:namespace/:name/logs", h.GetPodLogs)
		priv.GET("/clusters/:id/pods/:namespace/:name/metrics", h.GetPodMetrics)

		// Pod 容器文件浏览 & 终端
		priv.GET("/clusters/:id/pods/:namespace/:name/files", h.ListPodFiles)
		priv.GET("/clusters/:id/pods/:namespace/:name/file", h.GetPodFile)
		priv.POST("/clusters/:id/pods/:namespace/:name/exec", h.ExecInPod)

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

		// OTA 更新 (前端资源包)
		priv.GET("/updates/latest", h.UpdatesLatest)
		priv.GET("/updates/history", h.UpdatesHistory)
		priv.POST("/updates/add-version", h.AddVersionRecord)
		priv.GET("/updates/dist.zip", h.UpdatesDownload)

		// 安全组白名单
		priv.GET("/whoami/ip", h.WhoamiIP)
		priv.GET("/security-groups/whitelists", h.ListSGWhitelists)
		priv.POST("/security-groups/whitelists", h.CreateSGWhitelist)
		priv.DELETE("/security-groups/whitelists/:id", h.DeleteSGWhitelist)
		priv.POST("/security-groups/whitelists/:id/apply", h.ApplySGWhitelist)

		// CLS 日志服务
		priv.GET("/cls/regions/:region/logsets", h.ListCLSLogsets)
		priv.GET("/cls/regions/:region/logsets/:logset_id/topics", h.ListCLSTopics)
		priv.POST("/cls/search", h.SearchCLSLogs)

		// 通知渠道（飞书 Webhook 等）
		priv.GET("/notifications/webhooks", h.ListNotificationWebhooks)
		priv.POST("/notifications/webhooks", h.CreateNotificationWebhook)
		priv.PUT("/notifications/webhooks/:id", h.UpdateNotificationWebhook)
		priv.DELETE("/notifications/webhooks/:id", h.DeleteNotificationWebhook)
		priv.POST("/notifications/webhooks/:id/test", h.TestNotificationWebhook)
	}
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
