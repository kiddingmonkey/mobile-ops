package api

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// 前端 dist.zip OTA 更新
// - GET /api/v1/updates/latest -> {"version":"<sha8>","size":123456,"released_at":"<mtime>"}
// - GET /api/v1/updates/dist.zip -> zip 二进制流 (支持 If-None-Match / ETag)
//
// dist.zip 路径: `updates.dist_zip_path` 或环境变量 MOBILEOPS_DIST_ZIP,
// 默认 /data2/haowu33/mobile/frontend/dist.zip

type distMeta struct {
	Version    string    // sha256 前 8 位
	FullSHA    string    // 全 hash 作 ETag
	Size       int64
	ReleasedAt time.Time
	Path       string
}

var (
	distCache   *distMeta
	distCacheMu sync.RWMutex
)

func distZipPath() string {
	if v := os.Getenv("MOBILEOPS_DIST_ZIP"); v != "" {
		return v
	}
	return "/data2/haowu33/mobile/frontend/dist.zip"
}

// 读 dist.zip,计算 sha256; 用 mtime 判断缓存失效
func loadDistMeta() (*distMeta, error) {
	p := distZipPath()
	info, err := os.Stat(p)
	if err != nil {
		return nil, err
	}
	distCacheMu.RLock()
	if distCache != nil && distCache.Path == p && distCache.ReleasedAt.Equal(info.ModTime()) && distCache.Size == info.Size() {
		m := distCache
		distCacheMu.RUnlock()
		return m, nil
	}
	distCacheMu.RUnlock()

	// 重算 sha
	f, err := os.Open(p)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return nil, err
	}
	sum := hex.EncodeToString(h.Sum(nil))
	m := &distMeta{
		Version:    sum[:8],
		FullSHA:    sum,
		Size:       info.Size(),
		ReleasedAt: info.ModTime(),
		Path:       p,
	}
	distCacheMu.Lock()
	distCache = m
	distCacheMu.Unlock()
	return m, nil
}

// GET /api/v1/updates/latest
func (h *Handler) UpdatesLatest(c *gin.Context) {
	m, err := loadDistMeta()
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(404, gin.H{"error": "dist.zip not found on server", "path": distZipPath()})
			return
		}
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{
		"version":     m.Version,
		"sha256":      m.FullSHA,
		"size":        m.Size,
		"released_at": m.ReleasedAt.UTC().Format(time.RFC3339),
		"download":    "/api/v1/updates/dist.zip",
	})
}

// GET /api/v1/updates/dist.zip
func (h *Handler) UpdatesDownload(c *gin.Context) {
	m, err := loadDistMeta()
	if err != nil {
		if os.IsNotExist(err) {
			c.String(404, "dist.zip not found")
			return
		}
		c.String(500, err.Error())
		return
	}
	// 304 支持: 客户端已持有相同版本时省流量
	if inm := c.GetHeader("If-None-Match"); inm != "" && strings.Trim(inm, `"`) == m.FullSHA {
		c.Status(304)
		return
	}
	c.Header("ETag", `"`+m.FullSHA+`"`)
	c.Header("Cache-Control", "no-cache")
	c.Header("Content-Length", strconv.FormatInt(m.Size, 10))
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", `attachment; filename="dist.zip"`)
	c.File(filepath.Clean(m.Path))
}
