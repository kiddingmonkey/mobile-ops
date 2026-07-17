package handlers

import (
	"encoding/json"
	"net/http"
	"os"
)

// VersionInfo 版本信息
type VersionInfo struct {
	Version     string `json:"version"`
	Build       string `json:"build"`
	DownloadURL string `json:"download_url"`
	Changelog   string `json:"changelog"`
	Required    bool   `json:"required"` // 是否强制更新
	FileSize    int64  `json:"file_size"`
	PublishedAt string `json:"published_at"`
}

// GetLatestVersion 获取最新版本信息（从腾讯云COS获取）
func GetLatestVersion(w http.ResponseWriter, r *http.Request) {
	// COS上的版本信息文件URL
	cosVersionURL := "https://cloudpilot-1234567890.cos.ap-guangzhou.myqcloud.com/releases/latest.json"

	// 如果环境变量中配置了COS域名，使用环境变量
	if customURL := getEnv("COS_VERSION_URL", ""); customURL != "" {
		cosVersionURL = customURL
	}

	// 从COS获取版本信息
	resp, err := http.Get(cosVersionURL)
	if err != nil {
		// 降级：返回默认版本信息
		defaultVersion := VersionInfo{
			Version:     "1.1.0",
			Build:       "12c2c89",
			DownloadURL: "",
			Changelog:   "当前版本",
			Required:    false,
		}
		respondJSON(w, defaultVersion)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respondError(w, http.StatusServiceUnavailable, "无法获取版本信息")
		return
	}

	var versionInfo VersionInfo
	if err := json.NewDecoder(resp.Body).Decode(&versionInfo); err != nil {
		respondError(w, http.StatusInternalServerError, "解析版本信息失败")
		return
	}

	respondJSON(w, versionInfo)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
