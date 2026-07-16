package api

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"mobile-ops/internal/models"
)

// GET /api/v1/whoami/ip 返回请求方公网 IP
// 优先使用 X-Forwarded-For / X-Real-IP,兜底 RemoteAddr
func (h *Handler) WhoamiIP(c *gin.Context) {
	ip := extractClientIP(c.Request)
	c.JSON(200, gin.H{"ip": ip})
}

func extractClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

// ============ 白名单模板 CRUD ============

func (h *Handler) ListSGWhitelists(c *gin.Context) {
	var list []models.SecurityGroupWhitelist
	err := h.db.SelectContext(c.Request.Context(), &list,
		`SELECT id, name, cloud_account_id, region, sg_id, port, protocol, description,
		 last_ip, last_updated_at, created_by, created_at, updated_at
		 FROM security_group_whitelists ORDER BY id DESC`)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	jsonList(c, list)
}

type createSGWReq struct {
	Name           string `json:"name" binding:"required"`
	CloudAccountID int64  `json:"cloud_account_id" binding:"required"`
	Region         string `json:"region" binding:"required"`
	SGID           string `json:"sg_id" binding:"required"`
	Port           string `json:"port"`
	Protocol       string `json:"protocol"`
	Description    string `json:"description"`
}

func (h *Handler) CreateSGWhitelist(c *gin.Context) {
	var r createSGWReq
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if r.Port == "" {
		r.Port = "ALL"
	}
	if r.Protocol == "" {
		r.Protocol = "TCP"
	}
	uid := c.GetInt64("user_id")
	var out models.SecurityGroupWhitelist
	err := h.db.QueryRowxContext(c.Request.Context(),
		`INSERT INTO security_group_whitelists(name, cloud_account_id, region, sg_id, port, protocol, description, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING id, name, cloud_account_id, region, sg_id, port, protocol, description,
		           last_ip, last_updated_at, created_by, created_at, updated_at`,
		r.Name, r.CloudAccountID, r.Region, r.SGID, r.Port, r.Protocol, r.Description, uid).StructScan(&out)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, out)
}

func (h *Handler) DeleteSGWhitelist(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if _, err := h.db.ExecContext(c.Request.Context(),
		`DELETE FROM security_group_whitelists WHERE id=$1`, id); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// ============ 一键更新 ============

type applyReq struct {
	IP string `json:"ip"` // 可选,不传则用请求方公网 IP
}

// POST /security-groups/whitelists/:id/apply
// 逻辑: 按 description 删旧规则 -> 添加当前 IP 的新规则 -> 更新 last_ip
func (h *Handler) ApplySGWhitelist(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var r applyReq
	_ = c.ShouldBindJSON(&r)

	ctx := c.Request.Context()

	// 1. 拿白名单配置
	var w models.SecurityGroupWhitelist
	err := h.db.GetContext(ctx, &w,
		`SELECT id, name, cloud_account_id, region, sg_id, port, protocol, description,
		 last_ip, last_updated_at, created_by, created_at, updated_at
		 FROM security_group_whitelists WHERE id=$1`, id)
	if err != nil {
		c.JSON(404, gin.H{"error": "whitelist not found"})
		return
	}

	// 2. 确定要放行的 IP
	ip := strings.TrimSpace(r.IP)
	if ip == "" {
		ip = extractClientIP(c.Request)
	}
	if ip == "" {
		c.JSON(400, gin.H{"error": "cannot determine client IP"})
		return
	}

	// 3. 拿云账号并解密, 用 region 覆盖 (白名单 region 可能与云账号默认 region 不同)
	vpcClient, err := h.config.GetVPCClientForRegion(ctx, w.CloudAccountID, w.Region)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	// description 兜底:用白名单名字作为规则标识
	desc := w.Name
	if w.Description != nil && *w.Description != "" {
		desc = *w.Description
	}

	// 4. 删旧规则 (按 description 匹配)
	deleted, err := vpcClient.DeleteRulesByDescription(ctx, w.SGID, desc)
	if err != nil {
		c.JSON(500, gin.H{"error": "delete old rules: " + err.Error()})
		return
	}

	// 5. 添加新规则
	if err := vpcClient.AddIngressRule(ctx, w.SGID, ip, w.Port, w.Protocol, desc); err != nil {
		c.JSON(500, gin.H{"error": "add new rule: " + err.Error()})
		return
	}

	// 6. 更新 last_ip
	now := time.Now()
	_, err = h.db.ExecContext(ctx,
		`UPDATE security_group_whitelists
		 SET last_ip=$1, last_updated_at=$2, updated_at=NOW() WHERE id=$3`,
		ip, now, id)
	if err != nil {
		// SG 已改成功,只是更新 DB 失败,返回 200 但带 warning
		c.JSON(200, gin.H{
			"ok": true, "ip": ip, "deleted": deleted,
			"warning": "SG updated but DB update failed: " + err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"ok":      true,
		"ip":      ip,
		"deleted": deleted,
		"sg_id":   w.SGID,
		"port":    w.Port,
	})
}
