package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"mobile-ops/internal/models"
	"mobile-ops/internal/services"
)

// jsonList 保证空列表序列化为 [] 而不是 null（Go nil slice 默认序列化成 null）
func jsonList[T any](c *gin.Context, list []T) {
	if list == nil {
		list = []T{}
	}
	c.JSON(200, list)
}

// ============ Auth ============

type loginReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *Handler) Login(c *gin.Context) {
	var r loginReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	var u models.User
	err := h.db.GetContext(c.Request.Context(), &u,
		`SELECT id, username, password_hash, display_name, email, role, last_login_at, created_at, updated_at
		 FROM users WHERE username=$1`, r.Username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(401, gin.H{"error": "invalid credentials"})
			return
		}
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	if !services.VerifyPassword(u.PasswordHash, r.Password) {
		c.JSON(401, gin.H{"error": "invalid credentials"})
		return
	}
	tok, err := h.auth.GenerateToken(&u)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	h.db.ExecContext(c.Request.Context(), `UPDATE users SET last_login_at=NOW() WHERE id=$1`, u.ID)
	c.JSON(200, gin.H{"token": tok, "user": u})
}

func (h *Handler) Me(c *gin.Context) {
	uid := c.GetInt64("user_id")
	var u models.User
	err := h.db.GetContext(c.Request.Context(), &u,
		`SELECT id, username, display_name, email, role, last_login_at, created_at, updated_at
		 FROM users WHERE id=$1`, uid)
	if err != nil {
		c.JSON(404, gin.H{"error": "not found"})
		return
	}
	c.JSON(200, u)
}

// ============ Grafana Sources ============

func (h *Handler) ListGrafanaSources(c *gin.Context) {
	list, err := h.config.ListGrafanaSources(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

type createGrafanaReq struct {
	Name      string `json:"name" binding:"required"`
	URL       string `json:"url" binding:"required"`
	Token     string `json:"token" binding:"required"`
	IsDefault bool   `json:"is_default"`
}

func (h *Handler) CreateGrafanaSource(c *gin.Context) {
	var r createGrafanaReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	uid := c.GetInt64("user_id")
	out, err := h.config.CreateGrafanaSource(c.Request.Context(), uid, r.Name, r.URL, r.Token, r.IsDefault)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, out)
}

func (h *Handler) DeleteGrafanaSource(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.config.DeleteGrafanaSource(c.Request.Context(), id); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// ============ Prom Sources ============

func (h *Handler) ListPromSources(c *gin.Context) {
	list, err := h.config.ListPromSources(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

type createPromReq struct {
	Name      string `json:"name" binding:"required"`
	URL       string `json:"url" binding:"required"`
	AuthType  string `json:"auth_type"`
	Auth      string `json:"auth"`
	IsDefault bool   `json:"is_default"`
}

func (h *Handler) CreatePromSource(c *gin.Context) {
	var r createPromReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if r.AuthType == "" {
		r.AuthType = "none"
	}
	uid := c.GetInt64("user_id")
	out, err := h.config.CreatePromSource(c.Request.Context(), uid, r.Name, r.URL, r.AuthType, r.Auth, r.IsDefault)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, out)
}

// ============ Cloud Accounts ============

func (h *Handler) ListCloudAccounts(c *gin.Context) {
	list, err := h.config.ListCloudAccounts(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

type createCloudReq struct {
	Name      string `json:"name" binding:"required"`
	Provider  string `json:"provider" binding:"required"`
	Region    string `json:"region" binding:"required"`
	SecretID  string `json:"secret_id" binding:"required"`
	SecretKey string `json:"secret_key" binding:"required"`
}

func (h *Handler) CreateCloudAccount(c *gin.Context) {
	var r createCloudReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	uid := c.GetInt64("user_id")
	out, err := h.config.CreateCloudAccount(c.Request.Context(), uid, r.Name, r.Provider, r.Region, r.SecretID, r.SecretKey)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, out)
}

// ============ Clusters ============

func (h *Handler) ListClusters(c *gin.Context) {
	list, err := h.config.ListClusters(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

type createClusterReq struct {
	Name               string  `json:"name" binding:"required"`
	DisplayName        string  `json:"display_name"`
	Provider           string  `json:"provider"`
	ProviderClusterID  string  `json:"provider_cluster_id"`
	Region             string  `json:"region"`
	CloudAccountID     *int64  `json:"cloud_account_id"`
	Kubeconfig         string  `json:"kubeconfig"`
	GrafanaSourceID    *int64  `json:"grafana_source_id"`
	GrafanaClusterVar  string  `json:"grafana_cluster_var"`
	PromSourceID       *int64  `json:"prom_source_id"`
	AutoPullKubeconfig bool    `json:"auto_pull_kubeconfig"`
	IsExtranet         bool    `json:"is_extranet"`
}

func (h *Handler) CreateCluster(c *gin.Context) {
	var r createClusterReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if r.Provider == "" {
		r.Provider = "tencent"
	}
	uid := c.GetInt64("user_id")
	out, err := h.config.CreateCluster(c.Request.Context(), services.CreateClusterInput{
		Name:               r.Name,
		DisplayName:        r.DisplayName,
		Provider:           r.Provider,
		ProviderClusterID:  r.ProviderClusterID,
		Region:             r.Region,
		CloudAccountID:     r.CloudAccountID,
		Kubeconfig:         r.Kubeconfig,
		GrafanaSourceID:    r.GrafanaSourceID,
		GrafanaClusterVar:  r.GrafanaClusterVar,
		PromSourceID:       r.PromSourceID,
		AutoPullKubeconfig: r.AutoPullKubeconfig,
		IsExtranet:         r.IsExtranet,
		UserID:             uid,
	})
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, out)
}

func (h *Handler) SyncCluster(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.config.SyncNodePools(c.Request.Context(), id); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

func (h *Handler) GetCluster(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	cl, err := h.config.GetCluster(c.Request.Context(), id)
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, cl)
}

type updateClusterReq struct {
	DisplayName       *string `json:"display_name"`
	Region            *string `json:"region"`
	ProviderClusterID *string `json:"provider_cluster_id"`
	CloudAccountID    *int64  `json:"cloud_account_id"`
	Kubeconfig        *string `json:"kubeconfig"`
	GrafanaSourceID   *int64  `json:"grafana_source_id"`
	GrafanaClusterVar *string `json:"grafana_cluster_var"`
	PromSourceID      *int64  `json:"prom_source_id"`
}

func (h *Handler) UpdateCluster(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var r updateClusterReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	out, err := h.config.UpdateCluster(c.Request.Context(), id, services.UpdateClusterInput{
		DisplayName:       r.DisplayName,
		Region:            r.Region,
		ProviderClusterID: r.ProviderClusterID,
		CloudAccountID:    r.CloudAccountID,
		Kubeconfig:        r.Kubeconfig,
		GrafanaSourceID:   r.GrafanaSourceID,
		GrafanaClusterVar: r.GrafanaClusterVar,
		PromSourceID:      r.PromSourceID,
	})
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, out)
}

func (h *Handler) DeleteCluster(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.config.DeleteClusterHard(c.Request.Context(), id); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

func (h *Handler) ClusterOverview(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ov, err := h.config.ClusterOverview(c.Request.Context(), id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, ov)
}

// ============ Node Pools & Metrics ============

func (h *Handler) ListNodePools(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var list []models.NodePool
	err := h.db.SelectContext(c.Request.Context(), &list,
		`SELECT * FROM node_pools WHERE cluster_id=$1`, id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

func (h *Handler) ClusterMetrics(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	m, err := h.config.ClusterMetrics(c.Request.Context(), id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, m)
}

// GrafanaPanel 后端代理拉 Grafana 面板 PNG
// GET /clusters/:id/grafana/panel?dash=xxx&panel=1&from=now-1h&to=now&theme=dark&w=800&h=400
func (h *Handler) GrafanaPanel(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	dash := c.Query("dash")
	panelStr := c.DefaultQuery("panel", "1")
	panel, _ := strconv.Atoi(panelStr)
	from := c.DefaultQuery("from", "now-1h")
	to := c.DefaultQuery("to", "now")
	theme := c.DefaultQuery("theme", "dark")
	w, _ := strconv.Atoi(c.DefaultQuery("w", "800"))
	h_, _ := strconv.Atoi(c.DefaultQuery("h", "400"))
	if dash == "" {
		c.JSON(400, gin.H{"error": "dash 参数必填"})
		return
	}
	png, ct, err := h.config.FetchGrafanaPanel(c.Request.Context(), id, dash, panel, w, h_, from, to, theme)
	if err != nil {
		c.JSON(502, gin.H{"error": err.Error()})
		return
	}
	c.Header("Cache-Control", "private, max-age=30")
	c.Data(200, ct, png)
}

// GrafanaDashboards 列出该集群关联 Grafana 的常用 dashboard
// 前端可以用来给用户选择显示哪个面板
func (h *Handler) GrafanaDashboards(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	list, err := h.config.ListGrafanaDashboardsForCluster(c.Request.Context(), id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

// ============ Scale ============

type precheckReq struct {
	ClusterID  int64 `json:"cluster_id" binding:"required"`
	NodePoolID int64 `json:"node_pool_id" binding:"required"`
	Delta      int   `json:"delta" binding:"required"`
}

func (h *Handler) ScalePrecheck(c *gin.Context) {
	var r precheckReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	res, err := h.scale.Precheck(c.Request.Context(), r.ClusterID, r.NodePoolID, r.Delta)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, res)
}

type submitReq struct {
	ClusterID     int64                       `json:"cluster_id" binding:"required"`
	NodePoolID    int64                       `json:"node_pool_id" binding:"required"`
	Delta         int                         `json:"delta" binding:"required"`
	TriggerSource string                      `json:"trigger_source"`
	AlertRef      string                      `json:"alert_ref"`
	Precheck      *services.PrecheckResult    `json:"precheck" binding:"required"`
}

func (h *Handler) ScaleSubmit(c *gin.Context) {
	var r submitReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	uid := c.GetInt64("user_id")
	if r.TriggerSource == "" {
		r.TriggerSource = "manual"
	}
	opID, err := h.scale.SubmitScale(context.Background(), uid, r.ClusterID, r.NodePoolID, r.Delta, r.TriggerSource, r.AlertRef, r.Precheck)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"operation_id": opID})
}

// ============ Operations ============

func (h *Handler) ListOperations(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	var list []models.Operation
	err := h.db.SelectContext(c.Request.Context(), &list,
		`SELECT * FROM operations ORDER BY started_at DESC LIMIT $1`, limit)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

func (h *Handler) GetOperation(c *gin.Context) {
	opid := c.Param("opid")
	var op models.Operation
	err := h.db.GetContext(c.Request.Context(), &op,
		`SELECT * FROM operations WHERE operation_id=$1`, opid)
	if err != nil {
		c.JSON(404, gin.H{"error": "not found"})
		return
	}
	c.JSON(200, op)
}

// ============ Alerts ============

func (h *Handler) AlertWebhook(c *gin.Context) {
	var p services.AlertManagerPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if err := h.alert.Ingest(c.Request.Context(), &p); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true, "received": len(p.Alerts)})
}

func (h *Handler) ListAlerts(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	list, err := h.alert.List(c.Request.Context(), limit)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

// ============ Shortcuts ============

func (h *Handler) ListShortcuts(c *gin.Context) {
	uid := c.GetInt64("user_id")
	var list []struct {
		ID          int64  `db:"id" json:"id"`
		Name        string `db:"name" json:"name"`
		ClusterID   int64  `db:"cluster_id" json:"cluster_id"`
		NodePoolID  int64  `db:"node_pool_id" json:"node_pool_id"`
		Action      string `db:"action" json:"action"`
		Delta       int    `db:"delta" json:"delta"`
		Icon        string `db:"icon" json:"icon"`
		SortOrder   int    `db:"sort_order" json:"sort_order"`
	}
	err := h.db.SelectContext(c.Request.Context(), &list,
		`SELECT id, name, cluster_id, node_pool_id, action, delta, icon, sort_order
		 FROM shortcuts WHERE user_id=$1 ORDER BY sort_order, id`, uid)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

type createShortcutReq struct {
	Name       string `json:"name" binding:"required"`
	ClusterID  int64  `json:"cluster_id" binding:"required"`
	NodePoolID int64  `json:"node_pool_id" binding:"required"`
	Action     string `json:"action" binding:"required"`
	Delta      int    `json:"delta" binding:"required"`
	Icon       string `json:"icon"`
}

func (h *Handler) CreateShortcut(c *gin.Context) {
	var r createShortcutReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	uid := c.GetInt64("user_id")
	if r.Icon == "" {
		r.Icon = "thunderbolt"
	}
	var id int64
	err := h.db.QueryRowContext(c.Request.Context(),
		`INSERT INTO shortcuts(user_id, name, cluster_id, node_pool_id, action, delta, icon)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		uid, r.Name, r.ClusterID, r.NodePoolID, r.Action, r.Delta, r.Icon).Scan(&id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"id": id})
}

func (h *Handler) DeleteShortcut(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	uid := c.GetInt64("user_id")
	_, err := h.db.ExecContext(c.Request.Context(),
		`DELETE FROM shortcuts WHERE id=$1 AND user_id=$2`, id, uid)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// ============ K8s Resources ============

func (h *Handler) ListK8sResources(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	resourceType := c.Param("type") // pods, deployments, services, configmaps, secrets, nodes
	namespace := c.DefaultQuery("namespace", "")

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found or kubeconfig not loaded"})
		return
	}

	var result interface{}
	var queryErr error

	switch resourceType {
	case "pods":
		result, queryErr = client.ListPods(ctx, namespace)
	case "deployments":
		result, queryErr = client.ListDeployments(ctx, namespace)
	case "services":
		result, queryErr = client.ListServices(ctx, namespace)
	case "configmaps":
		result, queryErr = client.ListConfigMaps(ctx, namespace)
	case "secrets":
		result, queryErr = client.ListSecrets(ctx, namespace)
	case "nodes":
		result, queryErr = client.ListNodes(ctx)
	default:
		c.JSON(400, gin.H{"error": "unsupported resource type"})
		return
	}

	if queryErr != nil {
		c.JSON(500, gin.H{"error": queryErr.Error()})
		return
	}
	c.JSON(200, result)
}

func (h *Handler) GetK8sResourceYAML(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	resourceType := c.Param("type")
	namespace := c.Query("namespace")
	name := c.Query("name")

	if namespace == "" || name == "" {
		c.JSON(400, gin.H{"error": "namespace and name required"})
		return
	}

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}

	var result interface{}
	var queryErr error

	switch resourceType {
	case "pods":
		result, queryErr = client.GetPodYAML(ctx, namespace, name)
	default:
		c.JSON(400, gin.H{"error": "unsupported resource type"})
		return
	}

	if queryErr != nil {
		c.JSON(500, gin.H{"error": queryErr.Error()})
		return
	}
	c.JSON(200, result)
}


// ============ Pod 详情 / 事件 / 日志 ============

// ListNamespaces GET /clusters/:id/namespaces
func (h *Handler) ListNamespaces(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	namespaces, err := client.ListNamespaces(ctx)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, namespaces)
}

// ListPods GET /clusters/:id/namespaces/:namespace/pods
func (h *Handler) ListPods(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ns := c.Param("namespace")
	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	pods, err := client.ListPods(ctx, ns)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, pods)
}

// GetPodDetail GET /clusters/:id/pods/:namespace/:name
func (h *Handler) GetPodDetail(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ns := c.Param("namespace")
	name := c.Param("name")
	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	detail, err := client.GetPodDetail(ctx, ns, name)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, detail)
}

// ListPodEvents GET /clusters/:id/pods/:namespace/:name/events
func (h *Handler) ListPodEvents(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ns := c.Param("namespace")
	name := c.Param("name")
	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	events, err := client.ListPodEvents(ctx, ns, name)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, events)
}

// GetPodLogs GET /clusters/:id/pods/:namespace/:name/logs?container=xxx&tail=500&previous=false
func (h *Handler) GetPodLogs(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ns := c.Param("namespace")
	name := c.Param("name")
	container := c.Query("container")
	tailLines, _ := strconv.ParseInt(c.DefaultQuery("tail", "500"), 10, 64)
	previous := c.Query("previous") == "true"
	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	logs, err := client.GetPodLogs(ctx, ns, name, container, tailLines, previous)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"logs": logs})
}

// GetNodePoolDetail GET /clusters/:id/node-pools/:pool_id
func (h *Handler) GetNodePoolDetail(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	poolID, _ := strconv.ParseInt(c.Param("pool_id"), 10, 64)
	ctx := c.Request.Context()
	// 1. 拿 cluster
	var cluster models.Cluster
	if err := h.db.GetContext(ctx, &cluster, `SELECT * FROM clusters WHERE id=$1`, clusterID); err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	// 2. 拿 node_pool
	var pool models.NodePool
	if err := h.db.GetContext(ctx, &pool, `SELECT * FROM node_pools WHERE id=$1 AND cluster_id=$2`, poolID, clusterID); err != nil {
		c.JSON(404, gin.H{"error": "node pool not found"})
		return
	}
	if pool.ProviderPoolID == nil || *pool.ProviderPoolID == "" {
		c.JSON(400, gin.H{"error": "node pool has no provider_pool_id"})
		return
	}
	if cluster.CloudAccountID == nil {
		c.JSON(400, gin.H{"error": "cluster has no cloud_account_id"})
		return
	}
	// 3. 调 TKE
	tkeClient, err := h.config.GetTKEClient(ctx, *cluster.CloudAccountID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	detail, err := tkeClient.GetNodePoolDetail(ctx, *cluster.ProviderClusterID, *pool.ProviderPoolID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, detail)
}

// ============ 版本管理 ============

type VersionInfo struct {
	Version     string `json:"version"`
	Build       string `json:"build"`
	DownloadURL string `json:"download_url"`
	Changelog   string `json:"changelog"`
	Required    bool   `json:"required"`
	FileSize    int64  `json:"file_size"`
	PublishedAt string `json:"published_at"`
}

// GetLatestVersion 获取最新版本信息（从GitHub Releases）
func (h *Handler) GetLatestVersion(c *gin.Context) {
	// GitHub Releases API
	githubAPI := "https://api.github.com/repos/kiddingmonkey/mobile-ops/releases/latest"

	// 获取最新Release信息
	resp, err := http.Get(githubAPI)
	if err != nil {
		// 降级：返回默认版本
		c.JSON(200, VersionInfo{
			Version:     "1.1.0",
			Build:       "d053b04",
			DownloadURL: "",
			Changelog:   "当前版本",
			Required:    false,
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		c.JSON(503, gin.H{"error": "无法获取版本信息"})
		return
	}

	// 解析GitHub Release响应
	var releaseData struct {
		TagName string `json:"tag_name"`
		Assets  []struct {
			Name               string `json:"name"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&releaseData); err != nil {
		c.JSON(500, gin.H{"error": "解析版本信息失败"})
		return
	}

	// 查找version.json
	var versionFileURL string
	for _, asset := range releaseData.Assets {
		if asset.Name == "version.json" {
			versionFileURL = asset.BrowserDownloadURL
			break
		}
	}

	// 如果有version.json，直接使用
	if versionFileURL != "" {
		versionResp, err := http.Get(versionFileURL)
		if err == nil && versionResp.StatusCode == 200 {
			var versionInfo VersionInfo
			if json.NewDecoder(versionResp.Body).Decode(&versionInfo) == nil {
				versionResp.Body.Close()
				c.JSON(200, versionInfo)
				return
			}
			versionResp.Body.Close()
		}
	}

	// 降级：返回默认信息
	c.JSON(200, VersionInfo{
		Version:     "1.1.0",
		Build:       "latest",
		DownloadURL: "",
		Changelog:   "请更新到最新版本",
		Required:    false,
	})
}

// ============ Pod 容器文件浏览 & 终端 ============

// ListPodFiles GET /clusters/:id/pods/:namespace/:name/files?container=xxx&path=/var/log
func (h *Handler) ListPodFiles(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ns := c.Param("namespace")
	name := c.Param("name")
	container := c.Query("container")
	path := c.DefaultQuery("path", "/")

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	files, err := client.ListFilesInPod(ctx, ns, name, container, path)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"path": path, "entries": files})
}

// GetPodFile GET /clusters/:id/pods/:namespace/:name/file?container=xxx&path=/var/log/xxx.log&tail=500
func (h *Handler) GetPodFile(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ns := c.Param("namespace")
	name := c.Param("name")
	container := c.Query("container")
	path := c.Query("path")
	tailStr := c.Query("tail")
	download := c.Query("download") == "1"

	if path == "" {
		c.JSON(400, gin.H{"error": "path is required"})
		return
	}

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}

	var content string
	if tailStr != "" {
		tail, _ := strconv.Atoi(tailStr)
		content, err = client.TailFileInPod(ctx, ns, name, container, path, tail)
	} else {
		// 默认最大1MB
		content, err = client.CatFileInPod(ctx, ns, name, container, path, 5*1024*1024)
	}
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	if download {
		// 触发下载
		filename := path
		if idx := lastIndex(filename, "/"); idx >= 0 {
			filename = filename[idx+1:]
		}
		c.Header("Content-Disposition", "attachment; filename=\""+filename+"\"")
		c.Header("Content-Type", "application/octet-stream")
		c.String(200, content)
		return
	}
	c.JSON(200, gin.H{"path": path, "content": content, "size": len(content)})
}

// ExecInPod POST /clusters/:id/pods/:namespace/:name/exec
// Body: { "container": "xxx", "command": ["ls", "-la"] }
func (h *Handler) ExecInPod(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ns := c.Param("namespace")
	name := c.Param("name")

	var req struct {
		Container string   `json:"container"`
		Command   []string `json:"command" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	if len(req.Command) == 0 {
		c.JSON(400, gin.H{"error": "command is required"})
		return
	}

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}

	stdout, stderr, execErr := client.ExecInPod(ctx, ns, name, req.Container, req.Command)
	result := gin.H{
		"stdout":  stdout,
		"stderr":  stderr,
		"command": req.Command,
	}
	if execErr != nil {
		result["error"] = execErr.Error()
	}
	c.JSON(200, result)
}

func lastIndex(s, sub string) int {
	last := -1
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			last = i
		}
	}
	return last
}
