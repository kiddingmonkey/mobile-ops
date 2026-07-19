package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

type OTAInfo struct {
	Version    string `json:"version"`
	Sha256     string `json:"sha256"`
	Size       int64  `json:"size"`
	ReleasedAt string `json:"released_at"`
	Download   string `json:"download"`
}

type VersionRecord struct {
	Version     string   `json:"version"`
	Sha256      string   `json:"sha256"`
	Size        int64    `json:"size"`
	ReleasedAt  string   `json:"released_at"`
	Changelog   []string `json:"changelog"`
	Description string   `json:"description"`
}

type VersionHistory struct {
	Versions []VersionRecord `json:"versions"`
}

const versionsFile = "/data2/haowu33/mobile/frontend/versions.json"

func (h *Handler) UpdatesLatest(c *gin.Context) {
	// dist.zip 路径
	zipPath := "/data2/haowu33/mobile/frontend/dist.zip"
	stat, err := os.Stat(zipPath)
	if err != nil {
		c.JSON(500, gin.H{"error": "dist.zip not found"})
		return
	}

	// 计算 SHA256
	f, _ := os.Open(zipPath)
	defer f.Close()
	hasher := sha256.New()
	io.Copy(hasher, f)
	sum := hex.EncodeToString(hasher.Sum(nil))

	// 读取 version.json 获取版本信息
	versionJsonPath := "/data2/haowu33/mobile/frontend/dist/version.json"
	version := "unknown"
	if data, err := os.ReadFile(versionJsonPath); err == nil {
		var versionInfo map[string]interface{}
		if json.Unmarshal(data, &versionInfo) == nil {
			// 使用 appVersion-buildSha 格式（与版本历史一致）
			appVersion, hasAppVersion := versionInfo["appVersion"].(string)
			buildSha, hasBuildSha := versionInfo["buildSha"].(string)

			if hasAppVersion && hasBuildSha && len(buildSha) >= 8 {
				version = appVersion + "-" + buildSha[:8]
			} else if hasBuildSha {
				version = buildSha
			} else if hasAppVersion {
				version = appVersion
			}
		}
	}

	c.JSON(200, OTAInfo{
		Version:    version,
		Sha256:     sum,
		Size:       stat.Size(),
		ReleasedAt: stat.ModTime().Format(time.RFC3339),
		Download:   "/api/v1/updates/dist.zip",
	})
}

func (h *Handler) UpdatesHistory(c *gin.Context) {
	// 读取版本历史文件
	data, err := os.ReadFile(versionsFile)
	if err != nil {
		// 如果文件不存在，返回空列表
		if os.IsNotExist(err) {
			c.JSON(200, VersionHistory{Versions: []VersionRecord{}})
			return
		}
		c.JSON(500, gin.H{"error": fmt.Sprintf("read versions file: %v", err)})
		return
	}

	var history VersionHistory
	if err := json.Unmarshal(data, &history); err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("parse versions file: %v", err)})
		return
	}

	c.JSON(200, history)
}

func (h *Handler) AddVersionRecord(c *gin.Context) {
	var req VersionRecord
	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}

	// 读取现有历史
	var history VersionHistory
	if data, err := os.ReadFile(versionsFile); err == nil {
		json.Unmarshal(data, &history)
	}

	// 检查版本是否已存在
	for i, v := range history.Versions {
		if v.Version == req.Version {
			// 更新现有版本
			history.Versions[i] = req
			goto save
		}
	}

	// 添加新版本（插入到开头，最新版本在前）
	history.Versions = append([]VersionRecord{req}, history.Versions...)

save:
	// 保存
	data, err := json.MarshalIndent(history, "", "  ")
	if err != nil {
		c.JSON(500, gin.H{"error": "marshal history"})
		return
	}

	// 确保目录存在
	os.MkdirAll(filepath.Dir(versionsFile), 0755)

	if err := os.WriteFile(versionsFile, data, 0644); err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("write versions file: %v", err)})
		return
	}

	c.JSON(200, gin.H{"message": "version record added"})
}

func (h *Handler) UpdatesDownload(c *gin.Context) {
	zipPath := "/data2/haowu33/mobile/frontend/dist.zip"
	c.FileAttachment(zipPath, "dist.zip")
}
