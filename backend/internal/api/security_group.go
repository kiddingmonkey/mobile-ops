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
		c.JSON(500, buildSGErrorResp("删除旧规则失败", "delete", err, w, ip, desc))
		return
	}

	// 5. 添加新规则
	if err := vpcClient.AddIngressRule(ctx, w.SGID, ip, w.Port, w.Protocol, desc); err != nil {
		c.JSON(500, buildSGErrorResp("添加新规则失败", "create", err, w, ip, desc))
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

// buildSGErrorResp 从错误里抽出 SDK code / requestId, 给出人话建议
func buildSGErrorResp(stage, op string, err error, w models.SecurityGroupWhitelist, ip, desc string) gin.H {
	raw := err.Error()

	// SDK 错误常见格式: "vpc delete [Code] message"
	code := ""
	if idx := strings.Index(raw, "["); idx >= 0 {
		rest := raw[idx+1:]
		if end := strings.Index(rest, "]"); end > 0 {
			code = rest[:end]
		}
	}

	// 抽 requestId
	reqID := ""
	if i := strings.Index(raw, "request id:"); i >= 0 {
		rest := strings.TrimSpace(raw[i+len("request id:"):])
		if end := strings.IndexAny(rest, "] "); end > 0 {
			reqID = strings.TrimSpace(rest[:end])
		}
	}

	// 给人话建议
	hint := ""
	switch {
	case strings.Contains(raw, "UnauthorizedOperation"), strings.Contains(raw, "no permission"):
		perm := "vpc:CreateSecurityGroupPolicies / vpc:DeleteSecurityGroupPolicies"
		if op == "create" {
			perm = "vpc:CreateSecurityGroupPolicies (+ vpc:DescribeSecurityGroupPolicies)"
		} else if op == "delete" {
			perm = "vpc:DeleteSecurityGroupPolicies (+ vpc:DescribeSecurityGroupPolicies)"
		}
		hint = "AK/SK 权限不足. 需要在腾讯云 CAM 里给这个子账号加以下权限:\n" + perm + "\n或直接给 QcloudVPCFullAccess (仅测试)"
	case strings.Contains(raw, "InvalidParameterValue.Range"):
		hint = "参数格式错. 检查 端口(数字/范围/ALL)、协议(TCP/UDP/ALL)、sg_id(sg-开头) 是否正确."
	case strings.Contains(raw, "InvalidParameter") && strings.Contains(raw, "SecurityGroupId"):
		hint = "安全组 ID 不存在或不属于当前云账号/地域. 请核对 sg_id 和地域."
	case strings.Contains(raw, "AuthFailure"):
		hint = "AK/SK 无效或已过期. 到设置 → 腾讯云 AK/SK 里检查."
	case strings.Contains(raw, "LimitExceeded"):
		hint = "安全组规则数已达上限. 需要先清理无用规则."
	default:
		hint = "腾讯云 API 返回错误. 可把 request_id 提交给腾讯云工单排查."
	}

	return gin.H{
		"error":      stage,
		"stage":      op,
		"code":       code,
		"request_id": reqID,
		"message":    raw,
		"hint":       hint,
		"context": gin.H{
			"sg_id":       w.SGID,
			"region":      w.Region,
			"port":        w.Port,
			"protocol":    w.Protocol,
			"description": desc,
			"ip":          ip,
		},
	}
}
