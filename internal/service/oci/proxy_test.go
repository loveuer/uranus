package oci

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/model"
	"gitea.loveuer.com/loveuer/uranus/v2/internal/service"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupProxyTestDB 创建测试用的内存数据库
func setupProxyTestDB(t *testing.T) *gorm.DB {
	dbName := fmt.Sprintf("file:memdb%d?mode=memory&cache=private", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dbName), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	err = db.AutoMigrate(
		&model.OciRepository{},
		&model.OciTag{},
		&model.OciManifest{},
		&model.OciBlob{},
		&model.OciManifestBlob{},
		&model.Setting{},
	)
	if err != nil {
		t.Fatalf("failed to migrate tables: %v", err)
	}

	return db
}

// setupProxyTestSettingService 创建测试用的 SettingService
func setupProxyTestSettingService(db *gorm.DB, upstreamURL string) *service.SettingService {
	svc := service.NewSettingService(db)
	if upstreamURL != "" {
		// 直接使用数据库设置值，避免 context 要求
		db.Create(&model.Setting{Key: "oci_upstream", Value: upstreamURL})
	}
	return svc
}

// createMockUpstream 创建模拟的上游 registry 服务器
// 返回服务器和请求计数器
func createMockUpstream(t *testing.T, manifestContent string, manifestDigest string) (*httptest.Server, *atomic.Int64) {
	var requestCount atomic.Int64

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
		t.Logf("[mock upstream] %s %s", r.Method, r.URL.Path)

		// 模拟认证 endpoint
		if strings.Contains(r.URL.Path, "/token") {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"token":"fake-token"}`))
			return
		}

		// 模拟 manifest endpoint
		if strings.Contains(r.URL.Path, "/manifests/") {
			w.Header().Set("Content-Type", "application/vnd.docker.distribution.manifest.v2+json")
			w.Header().Set("Docker-Content-Digest", manifestDigest)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(manifestContent))
			return
		}

		// 其他请求返回 404
		w.WriteHeader(http.StatusNotFound)
	}))

	return server, &requestCount
}

// setupProxyCacheData 在数据库中预填充缓存数据
func setupProxyCacheData(t *testing.T, db *gorm.DB, repoName, tag, digest, content string) {
	ctx := context.Background()

	// 创建仓库
	repo := model.OciRepository{
		Name:     repoName,
		Upstream: "https://docker.io",
	}
	if err := db.WithContext(ctx).Create(&repo).Error; err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}

	// 创建 manifest
	manifest := model.OciManifest{
		RepositoryID: repo.ID,
		Digest:       digest,
		MediaType:    "application/vnd.docker.distribution.manifest.v2+json",
		Content:      content,
		Size:         int64(len(content)),
	}
	if err := db.WithContext(ctx).Create(&manifest).Error; err != nil {
		t.Fatalf("failed to create manifest: %v", err)
	}

	// 创建 tag（如果不是 digest 引用）
	if tag != "" {
		tagRecord := model.OciTag{
			RepositoryID:   repo.ID,
			Tag:            tag,
			ManifestDigest: digest,
		}
		if err := db.WithContext(ctx).Create(&tagRecord).Error; err != nil {
			t.Fatalf("failed to create tag: %v", err)
		}
	}
}

// TestProxyManifest_DigestReference_UsesCache 测试 digest 引用走缓存
func TestProxyManifest_DigestReference_UsesCache(t *testing.T) {
	db := setupProxyTestDB(t)
	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")

	// 创建模拟上游（不应该被调用）
	mockManifest := `{"schemaVersion":2,"mediaType":"application/vnd.docker.distribution.manifest.v2+json"}`
	mockDigest := "sha256:cacheddigest123"
	server, requestCount := createMockUpstream(t, mockManifest, mockDigest)
	defer server.Close()

	// 预填充缓存数据
	setupProxyCacheData(t, db, "library/nginx", "", mockDigest, mockManifest)

	// 创建 service
	settingSvc := setupProxyTestSettingService(db, server.URL)
	svc := New(db, dataDir, settingSvc)

	ctx := context.Background()

	// 调用 ProxyManifest 使用 digest 引用
	content, mediaType, digest, err := svc.ProxyManifest(ctx, "nginx", mockDigest)

	// 验证结果
	if err != nil {
		t.Fatalf("ProxyManifest failed: %v", err)
	}
	if string(content) != mockManifest {
		t.Errorf("content mismatch: got %q, want %q", string(content), mockManifest)
	}
	if mediaType != "application/vnd.docker.distribution.manifest.v2+json" {
		t.Errorf("mediaType mismatch: got %q, want %q", mediaType, "application/vnd.docker.distribution.manifest.v2+json")
	}
	if digest != mockDigest {
		t.Errorf("digest mismatch: got %q, want %q", digest, mockDigest)
	}

	// 验证上游没有被请求
	if requestCount.Load() != 0 {
		t.Errorf("expected 0 upstream requests for cached digest, got %d", requestCount.Load())
	}
}

// TestProxyManifest_FixedTag_UsesCache 测试固定 tag 走缓存
func TestProxyManifest_FixedTag_UsesCache(t *testing.T) {
	db := setupProxyTestDB(t)
	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")

	// 创建模拟上游（不应该被调用）
	mockManifest := `{"schemaVersion":2,"mediaType":"application/vnd.docker.distribution.manifest.v2+json"}`
	mockDigest := "sha256:cacheddigest456"
	server, requestCount := createMockUpstream(t, mockManifest, mockDigest)
	defer server.Close()

	// 预填充缓存数据
	setupProxyCacheData(t, db, "library/nginx", "1.26.2", mockDigest, mockManifest)

	// 创建 service
	settingSvc := setupProxyTestSettingService(db, server.URL)
	svc := New(db, dataDir, settingSvc)

	ctx := context.Background()

	// 调用 ProxyManifest 使用固定 tag
	content, mediaType, digest, err := svc.ProxyManifest(ctx, "nginx", "1.26.2")

	// 验证结果
	if err != nil {
		t.Fatalf("ProxyManifest failed: %v", err)
	}
	if string(content) != mockManifest {
		t.Errorf("content mismatch: got %q, want %q", string(content), mockManifest)
	}
	if mediaType != "application/vnd.docker.distribution.manifest.v2+json" {
		t.Errorf("mediaType mismatch: got %q, want %q", mediaType, "application/vnd.docker.distribution.manifest.v2+json")
	}
	if digest != mockDigest {
		t.Errorf("digest mismatch: got %q, want %q", digest, mockDigest)
	}

	// 验证上游没有被请求
	if requestCount.Load() != 0 {
		t.Errorf("expected 0 upstream requests for cached fixed tag, got %d", requestCount.Load())
	}
}

// TestProxyManifest_LatestTag_FetchesUpstream 测试 latest tag 不走缓存
func TestProxyManifest_LatestTag_FetchesUpstream(t *testing.T) {
	db := setupProxyTestDB(t)
	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")

	// 创建模拟上游（应该被调用）
	upstreamManifest := `{"schemaVersion":2,"mediaType":"application/vnd.docker.distribution.manifest.v2+json","config":{"size":100,"digest":"sha256:config123"}}`
	upstreamDigest := "sha256:upstreamlatest"
	server, requestCount := createMockUpstream(t, upstreamManifest, upstreamDigest)
	defer server.Close()

	// 预填充过时的缓存数据（模拟 latest 标签已过期）
	cachedManifest := `{"schemaVersion":2,"mediaType":"application/vnd.docker.distribution.manifest.v2+json","config":{"size":50,"digest":"sha256:oldconfig"}}`
	cachedDigest := "sha256:oldcachedigest"
	setupProxyCacheData(t, db, "library/nginx", "latest", cachedDigest, cachedManifest)

	// 创建 service
	settingSvc := setupProxyTestSettingService(db, server.URL)
	svc := New(db, dataDir, settingSvc)

	ctx := context.Background()

	// 调用 ProxyManifest 使用 latest tag
	content, _, digest, err := svc.ProxyManifest(ctx, "nginx", "latest")

	// 验证结果 - 应该获取上游的最新版本
	if err != nil {
		t.Fatalf("ProxyManifest failed: %v", err)
	}
	if string(content) != upstreamManifest {
		t.Errorf("content mismatch: got %q, want %q", string(content), upstreamManifest)
	}
	if digest != upstreamDigest {
		t.Errorf("digest mismatch: got %q, want %q", digest, upstreamDigest)
	}

	// 验证上游被请求了（至少一次，singleflight 可能会合并并发请求）
	if requestCount.Load() == 0 {
		t.Error("expected upstream to be fetched for latest tag, but no requests were made")
	}
}

// TestProxyManifest_CacheMiss_FetchesUpstream 测试缓存未命中时从上游获取
func TestProxyManifest_CacheMiss_FetchesUpstream(t *testing.T) {
	db := setupProxyTestDB(t)
	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")

	// 创建模拟上游（应该被调用）
	upstreamManifest := `{"schemaVersion":2,"mediaType":"application/vnd.docker.distribution.manifest.v2+json"}`
	upstreamDigest := "sha256:newdigest789"
	server, requestCount := createMockUpstream(t, upstreamManifest, upstreamDigest)
	defer server.Close()

	// 不预填充缓存数据

	// 创建 service
	settingSvc := setupProxyTestSettingService(db, server.URL)
	svc := New(db, dataDir, settingSvc)

	ctx := context.Background()

	// 调用 ProxyManifest 使用未缓存的 tag
	content, _, digest, err := svc.ProxyManifest(ctx, "nginx", "1.26.2")

	// 验证结果 - 应该从上游获取
	if err != nil {
		t.Fatalf("ProxyManifest failed: %v", err)
	}
	if string(content) != upstreamManifest {
		t.Errorf("content mismatch: got %q, want %q", string(content), upstreamManifest)
	}
	if digest != upstreamDigest {
		t.Errorf("digest mismatch: got %q, want %q", digest, upstreamDigest)
	}

	// 验证上游被请求了
	if requestCount.Load() == 0 {
		t.Error("expected upstream to be fetched for cache miss, but no requests were made")
	}

	// 验证数据已保存到数据库
	var tag model.OciTag
	err = db.Joins("JOIN oci_repositories ON oci_repositories.id = oci_tags.repository_id").
		Where("oci_repositories.name = ? AND oci_tags.tag = ?", "library/nginx", "1.26.2").
		First(&tag).Error
	if err != nil {
		t.Errorf("expected tag to be saved to database, but got error: %v", err)
	}
}

// TestIsMutableTag 测试 isMutableTag 函数
func TestIsMutableTag(t *testing.T) {
	tests := []struct {
		tag      string
		expected bool
	}{
		{"latest", true},
		{"1.0.0", false},
		{"1.26.2-alpine", false},
		{"v2.0", false},
		{"stable", false}, // 目前只将 latest 视为可变
		{"nightly", false},
		{"main", false},
		{"master", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.tag, func(t *testing.T) {
			result := isMutableTag(tt.tag)
			if result != tt.expected {
				t.Errorf("isMutableTag(%q) = %v, want %v", tt.tag, result, tt.expected)
			}
		})
	}
}

// TestIsDigest 测试 isDigest 函数
func TestIsDigest(t *testing.T) {
	tests := []struct {
		ref      string
		expected bool
	}{
		{"sha256:abc123", true},
		{"sha256:", false}, // 只有前缀没有内容
		{"sha256", false},  // 缺少冒号
		{"latest", false},
		{"1.0.0", false},
		{"", false},
		{"sha256:abc", true}, // 短内容也可以（只要前缀正确）
	}

	for _, tt := range tests {
		t.Run(tt.ref, func(t *testing.T) {
			result := isDigest(tt.ref)
			if result != tt.expected {
				t.Errorf("isDigest(%q) = %v, want %v", tt.ref, result, tt.expected)
			}
		})
	}
}

// TestProxyManifest_DockerHubLibraryPrefix 测试 Docker Hub 镜像的 library/ 前缀处理
func TestProxyManifest_DockerHubLibraryPrefix(t *testing.T) {
	db := setupProxyTestDB(t)
	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")

	// 创建模拟上游
	mockManifest := `{"schemaVersion":2}`
	mockDigest := "sha256:testdigest"
	server, requestCount := createMockUpstream(t, mockManifest, mockDigest)
	defer server.Close()

	// 预填充缓存数据时使用 library/ 前缀（这是 normalizeImageName 的行为）
	setupProxyCacheData(t, db, "library/nginx", "1.0", mockDigest, mockManifest)

	// 创建 service，上游设置为 Docker Hub
	settingSvc := setupProxyTestSettingService(db, server.URL)
	// 设置 upstream 为 docker.io 以触发 library/ 前缀逻辑
	db.Create(&model.Setting{Key: "oci_upstream", Value: "https://docker.io"})
	svc := New(db, dataDir, settingSvc)

	ctx := context.Background()

	// 使用短名称请求（不带 library/）
	content, _, _, err := svc.ProxyManifest(ctx, "nginx", "1.0")

	if err != nil {
		t.Fatalf("ProxyManifest failed: %v", err)
	}
	if string(content) != mockManifest {
		t.Errorf("content mismatch: got %q, want %q", string(content), mockManifest)
	}

	// 验证上游没有被请求（说明本地缓存命中）
	if requestCount.Load() != 0 {
		t.Errorf("expected cache hit with library/ prefix normalization, but got %d upstream requests", requestCount.Load())
	}
}

// TestProxyManifest_ConcurrentRequests 测试并发请求只触发一次上游请求
func TestProxyManifest_ConcurrentRequests(t *testing.T) {
	db := setupProxyTestDB(t)
	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")

	// 创建模拟上游（延迟响应以模拟网络请求）
	mockManifest := `{"schemaVersion":2}`
	mockDigest := "sha256:concurrenttest"
	var requestCount atomic.Int64

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/token") {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"token":"fake-token"}`))
			return
		}
		requestCount.Add(1)
		time.Sleep(50 * time.Millisecond) // 模拟网络延迟
		w.Header().Set("Content-Type", "application/vnd.docker.distribution.manifest.v2+json")
		w.Header().Set("Docker-Content-Digest", mockDigest)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(mockManifest))
	}))
	defer server.Close()

	// 不预填充缓存

	// 创建 service
	settingSvc := setupProxyTestSettingService(db, server.URL)
	svc := New(db, dataDir, settingSvc)

	ctx := context.Background()

	// 并发发起 10 个相同请求
	const concurrency = 10
	var wg sync.WaitGroup
	errors := make(chan error, concurrency)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, _, err := svc.ProxyManifest(ctx, "nginx", "latest")
			if err != nil {
				errors <- err
			}
		}()
	}

	wg.Wait()
	close(errors)

	// 验证没有错误
	for err := range errors {
		t.Errorf("concurrent request failed: %v", err)
	}

	// 验证上游只被请求了一次（singleflight 的作用）
	if requestCount.Load() != 1 {
		t.Errorf("expected 1 upstream request due to singleflight, got %d", requestCount.Load())
	}
}
