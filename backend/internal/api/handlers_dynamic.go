package api

import (
	"encoding/json"
	"strconv"

	"github.com/gin-gonic/gin"
	"sigs.k8s.io/yaml"
)

// ListCRDs GET /clusters/:id/crds
func (h *Handler) ListCRDs(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	crds, err := client.ListCRDs(ctx)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, crds)
}

// ListCRDResources GET /clusters/:id/crds/:group/:version/:resource
func (h *Handler) ListCRDResources(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	group := c.Param("group")
	version := c.Param("version")
	resource := c.Param("resource")
	namespace := c.Query("namespace")

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	items, err := client.ListDynamicResources(ctx, group, version, resource, namespace)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, items)
}

// GetCRDResourceYAML GET /clusters/:id/crds/:group/:version/:resource/yaml?namespace=&name=
func (h *Handler) GetCRDResourceYAML(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	group := c.Param("group")
	version := c.Param("version")
	resource := c.Param("resource")
	namespace := c.Query("namespace")
	name := c.Query("name")

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	obj, err := client.GetDynamicYAML(ctx, group, version, resource, namespace, name)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, obj)
}

// UpdateResourceYAML PUT /clusters/:id/resources/yaml
// body: {yaml: string, note?: string}
// 会先把当前内容存到 resource_revisions，再 apply 新 yaml
func (h *Handler) UpdateResourceYAML(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var body struct {
		YAML string `json:"yaml"`
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if body.YAML == "" {
		c.JSON(400, gin.H{"error": "yaml is required"})
		return
	}

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}

	// 解析出 apiVersion/kind/namespace/name 用于快照
	jsonBytes, err := yaml.YAMLToJSON([]byte(body.YAML))
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid yaml: " + err.Error()})
		return
	}
	var meta struct {
		APIVersion string `json:"apiVersion"`
		Kind       string `json:"kind"`
		Metadata   struct {
			Name      string `json:"name"`
			Namespace string `json:"namespace"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal(jsonBytes, &meta); err != nil {
		c.JSON(400, gin.H{"error": "parse metadata: " + err.Error()})
		return
	}
	if meta.APIVersion == "" || meta.Kind == "" || meta.Metadata.Name == "" {
		c.JSON(400, gin.H{"error": "apiVersion, kind, metadata.name are required"})
		return
	}

	// 拉取当前对象作为快照
	oldYAMLBytes := []byte{}
	if group, version, resource, _, err := client.ResolveKindToResource(meta.APIVersion, meta.Kind); err == nil {
		curObj, err := client.GetDynamicYAML(ctx, group, version, resource, meta.Metadata.Namespace, meta.Metadata.Name)
		if err == nil {
			if b, err := yaml.Marshal(curObj); err == nil {
				oldYAMLBytes = b
			}
		}
	}

	// 存快照（无论 old 拿没拿到，都记录本次 apply 的动机）
	if len(oldYAMLBytes) > 0 {
		username, _ := c.Get("username")
		_, _ = h.db.ExecContext(ctx,
			`INSERT INTO resource_revisions (cluster_id, api_version, kind, namespace, name, yaml_content, operator, note)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			clusterID, meta.APIVersion, meta.Kind, meta.Metadata.Namespace, meta.Metadata.Name,
			string(oldYAMLBytes), toString(username), body.Note,
		)
	}

	// Apply
	if err := client.ApplyYAML(ctx, body.YAML); err != nil {
		c.JSON(500, gin.H{"error": "apply failed: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// ListResourceRevisions GET /clusters/:id/resources/revisions?apiVersion=&kind=&namespace=&name=
func (h *Handler) ListResourceRevisions(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	apiVersion := c.Query("apiVersion")
	kind := c.Query("kind")
	namespace := c.Query("namespace")
	name := c.Query("name")

	ctx := c.Request.Context()
	rows, err := h.db.QueryxContext(ctx,
		`SELECT id, cluster_id, api_version, kind, namespace, name, operator, note, created_at
		 FROM resource_revisions
		 WHERE cluster_id=$1 AND api_version=$2 AND kind=$3 AND namespace=$4 AND name=$5
		 ORDER BY created_at DESC LIMIT 50`,
		clusterID, apiVersion, kind, namespace, name,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, cid int64
		var av, k, ns, nm, op, note string
		var createdAt any
		if err := rows.Scan(&id, &cid, &av, &k, &ns, &nm, &op, &note, &createdAt); err == nil {
			out = append(out, map[string]any{
				"id":          id,
				"api_version": av,
				"kind":        k,
				"namespace":   ns,
				"name":        nm,
				"operator":    op,
				"note":        note,
				"created_at":  createdAt,
			})
		}
	}
	c.JSON(200, out)
}

// GetResourceRevision GET /clusters/:id/resources/revisions/:rev_id
func (h *Handler) GetResourceRevision(c *gin.Context) {
	revID, _ := strconv.ParseInt(c.Param("rev_id"), 10, 64)
	ctx := c.Request.Context()
	var yamlContent, apiVersion, kind, namespace, name string
	err := h.db.QueryRowxContext(ctx,
		`SELECT yaml_content, api_version, kind, namespace, name FROM resource_revisions WHERE id=$1`,
		revID,
	).Scan(&yamlContent, &apiVersion, &kind, &namespace, &name)
	if err != nil {
		c.JSON(404, gin.H{"error": "revision not found"})
		return
	}
	c.JSON(200, gin.H{
		"yaml":        yamlContent,
		"api_version": apiVersion,
		"kind":        kind,
		"namespace":   namespace,
		"name":        name,
	})
}

// RollbackToRevision POST /clusters/:id/resources/revisions/:rev_id/rollback
func (h *Handler) RollbackToRevision(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	revID, _ := strconv.ParseInt(c.Param("rev_id"), 10, 64)
	ctx := c.Request.Context()

	var yamlContent string
	if err := h.db.QueryRowxContext(ctx,
		`SELECT yaml_content FROM resource_revisions WHERE id=$1 AND cluster_id=$2`,
		revID, clusterID,
	).Scan(&yamlContent); err != nil {
		c.JSON(404, gin.H{"error": "revision not found"})
		return
	}

	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	if err := client.ApplyYAML(ctx, yamlContent); err != nil {
		c.JSON(500, gin.H{"error": "rollback failed: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// ================= 快捷操作 =================

// RestartWorkload POST /clusters/:id/workloads/:kind/:namespace/:name/restart
func (h *Handler) RestartWorkload(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	kind := c.Param("kind")
	namespace := c.Param("namespace")
	name := c.Param("name")

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	if err := client.RolloutRestart(ctx, kind, namespace, name); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// ScaleWorkload POST /clusters/:id/workloads/:kind/:namespace/:name/scale  body: {replicas: n}
func (h *Handler) ScaleWorkload(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	kind := c.Param("kind")
	namespace := c.Param("namespace")
	name := c.Param("name")

	var body struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if body.Replicas < 0 {
		c.JSON(400, gin.H{"error": "replicas must be >= 0"})
		return
	}

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	if err := client.ScaleWorkload(ctx, kind, namespace, name, body.Replicas); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// PauseDeployment POST /clusters/:id/deployments/:namespace/:name/pause  body: {paused: bool}
func (h *Handler) PauseDeployment(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	namespace := c.Param("namespace")
	name := c.Param("name")

	var body struct {
		Paused bool `json:"paused"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	if err := client.TogglePause(ctx, namespace, name, body.Paused); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// DeleteResource DELETE /clusters/:id/resources/delete?apiVersion=&kind=&namespace=&name=
func (h *Handler) DeleteResource(c *gin.Context) {
	clusterID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	apiVersion := c.Query("apiVersion")
	kind := c.Query("kind")
	namespace := c.Query("namespace")
	name := c.Query("name")

	if apiVersion == "" || kind == "" || name == "" {
		c.JSON(400, gin.H{"error": "apiVersion, kind, name are required"})
		return
	}

	ctx := c.Request.Context()
	client, err := h.config.GetK8sClient(ctx, clusterID)
	if err != nil {
		c.JSON(404, gin.H{"error": "cluster not found"})
		return
	}
	if err := client.DeleteResource(ctx, apiVersion, kind, namespace, name); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// ============ helpers ============

func toString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

