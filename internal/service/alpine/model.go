// Package alpine 提供 Alpine Linux APK 仓库代理服务
package alpine

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// IndexKey 索引缓存键
type IndexKey struct {
	Branch string // v3.19, edge
	Repo   string // main, community
	Arch   string // x86_64, aarch64
}

func (k IndexKey) String() string {
	return fmt.Sprintf("%s/%s/%s", k.Branch, k.Repo, k.Arch)
}

// PackageInfo APK 包信息
type PackageInfo struct {
	Name          string
	Version       string
	Architecture  string
	Description   string
	URL           string
	License       string
	Maintainer    string
	Size          int64
	InstalledSize int64
	Checksum      string // Q1+base64(SHA1)
	Origin        string
	BuildTime     time.Time
	Commit        string

	// 缓存状态
	IsCached  bool
	CachePath string
	CacheTime time.Time
}

// IndexCache 索引缓存信息
type IndexCache struct {
	Key IndexKey

	// 文件路径
	LocalPath string

	// HTTP 缓存头
	ETag         string
	LastModified time.Time

	// 解析后的包列表
	Packages map[string]*PackageInfo

	// 状态
	LastSync time.Time
	IsValid  bool
}

// IsExpired 检查缓存是否过期
func (ic *IndexCache) IsExpired(duration time.Duration) bool {
	return time.Since(ic.LastSync) > duration
}

// Exists 检查缓存文件是否存在
func (ic *IndexCache) Exists() bool {
	if ic.LocalPath == "" {
		return false
	}
	_, err := os.Stat(ic.LocalPath)
	return err == nil
}

// Repository 仓库配置
type Repository struct {
	ID          uint
	Name        string   // 显示名称
	UpstreamURL string   // 上游地址
	Branches    []string // ["v3.19", "edge"]
	Repos       []string // ["main", "community"]
	Archs       []string // ["x86_64", "aarch64"]

	// 同步配置
	SyncInterval time.Duration // 默认30分钟
	CacheTTL     time.Duration // 默认5分钟

	// 状态
	LastSync  time.Time
	IsEnabled bool
}

// DefaultRepository 返回默认仓库配置
func DefaultRepository() *Repository {
	return &Repository{
		Name:         "Alpine Linux",
		UpstreamURL:  "https://dl-cdn.alpinelinux.org/alpine",
		Branches:     []string{"v3.23", "v3.22", "v3.21", "v3.20", "edge"},
		Repos:        []string{"main", "community"},
		Archs:        []string{"x86_64", "aarch64", "armv7", "x86"},
		SyncInterval: 30 * time.Minute,
		CacheTTL:     5 * time.Minute,
		IsEnabled:    true,
	}
}

// SyncStatus 同步状态
type SyncStatus struct {
	Key       IndexKey
	Status    string    // pending, syncing, success, failed
	Message   string
	StartedAt time.Time
	EndedAt   time.Time
}

// CacheStats 缓存统计
type CacheStats struct {
	TotalIndexes   int
	TotalPackages  int
	CachedPackages int
	CacheSize      int64
}

// ParseChecksum 解析 APK 的 Q1+base64 校验和
func ParseChecksum(checksum string) ([]byte, error) {
	if !strings.HasPrefix(checksum, "Q1") {
		return nil, fmt.Errorf("invalid checksum format: %s", checksum)
	}
	// Q1 前缀表示 base64 编码的 SHA1
	// 实际解码需要 base64 解码
	return []byte(checksum[2:]), nil
}
