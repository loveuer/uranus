package alpine

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// IndexManager 索引管理器
type IndexManager struct {
	localDir string
	parser   *IndexParser

	// 内存缓存
	mu      sync.RWMutex
	caches  map[IndexKey]*IndexCache
	repo    *Repository
}

// NewIndexManager 创建索引管理器
func NewIndexManager(localDir string, repo *Repository) *IndexManager {
	return &IndexManager{
		localDir: localDir,
		parser:   NewIndexParser(),
		caches:   make(map[IndexKey]*IndexCache),
		repo:     repo,
	}
}

// GetCache 获取索引缓存（线程安全）
func (im *IndexManager) GetCache(key IndexKey) *IndexCache {
	im.mu.RLock()
	cache, ok := im.caches[key]
	im.mu.RUnlock()

	if ok {
		return cache
	}

	// 创建新缓存
	im.mu.Lock()
	defer im.mu.Unlock()

	// 双重检查
	if cache, ok := im.caches[key]; ok {
		return cache
	}

	cache = &IndexCache{
		Key:       key,
		LocalPath: im.getIndexPath(key),
		Packages:  make(map[string]*PackageInfo),
	}
	im.caches[key] = cache

	// 尝试加载已有缓存
	if cache.Exists() {
		im.loadCache(cache)
	}

	return cache
}

// UpdateCache 更新缓存信息
func (im *IndexManager) UpdateCache(key IndexKey, syncTime time.Time) {
	im.mu.Lock()
	defer im.mu.Unlock()

	if cache, ok := im.caches[key]; ok {
		cache.LastSync = syncTime
		cache.IsValid = true
		// 重新解析
		im.loadCache(cache)
	}
}

// loadCache 加载并解析索引
func (im *IndexManager) loadCache(cache *IndexCache) {
	packages, err := im.parser.ParseFile(cache.LocalPath)
	if err != nil {
		return
	}

	cache.Packages = packages
	cache.IsValid = true

	// 获取文件信息
	if fi, err := os.Stat(cache.LocalPath); err == nil {
		cache.LastSync = fi.ModTime()
	}
}

// getIndexPath 获取索引文件路径
func (im *IndexManager) getIndexPath(key IndexKey) string {
	return filepath.Join(im.localDir, key.Branch, key.Repo, key.Arch, "APKINDEX.tar.gz")
}

// GetPackage 从缓存获取包信息
func (im *IndexManager) GetPackage(key IndexKey, name string) (*PackageInfo, bool) {
	cache := im.GetCache(key)

	im.mu.RLock()
	defer im.mu.RUnlock()

	pkg, ok := cache.Packages[name]
	return pkg, ok
}

// SearchPackages 搜索包
func (im *IndexManager) SearchPackages(key IndexKey, query string) []*PackageInfo {
	cache := im.GetCache(key)

	im.mu.RLock()
	defer im.mu.RUnlock()

	var results []*PackageInfo
	for _, pkg := range cache.Packages {
		if contains(pkg.Name, query) || contains(pkg.Description, query) {
			results = append(results, pkg)
		}
	}

	return results
}

// ListPackages 列出所有包
func (im *IndexManager) ListPackages(key IndexKey) []*PackageInfo {
	cache := im.GetCache(key)

	im.mu.RLock()
	defer im.mu.RUnlock()

	results := make([]*PackageInfo, 0, len(cache.Packages))
	for _, pkg := range cache.Packages {
		results = append(results, pkg)
	}

	return results
}

// GetAllCaches 获取所有缓存
func (im *IndexManager) GetAllCaches() []*IndexCache {
	im.mu.RLock()
	defer im.mu.RUnlock()

	result := make([]*IndexCache, 0, len(im.caches))
	for _, cache := range im.caches {
		result = append(result, cache)
	}

	return result
}

// GetStats 获取统计信息
func (im *IndexManager) GetStats() CacheStats {
	im.mu.RLock()
	defer im.mu.RUnlock()

	stats := CacheStats{
		TotalIndexes: len(im.caches),
	}

	for _, cache := range im.caches {
		if cache.IsValid {
			stats.TotalPackages += len(cache.Packages)
		}

		// 计算缓存大小
		if cache.Exists() {
			if fi, err := os.Stat(cache.LocalPath); err == nil {
				stats.CacheSize += fi.Size()
			}
		}
	}

	return stats
}

// InvalidateCache 使缓存失效
func (im *IndexManager) InvalidateCache(key IndexKey) {
	im.mu.Lock()
	defer im.mu.Unlock()

	if cache, ok := im.caches[key]; ok {
		cache.IsValid = false
	}
}

// CleanCache 清理缓存
func (im *IndexManager) CleanCache() error {
	im.mu.Lock()
	defer im.mu.Unlock()

	// 清空内存缓存
	im.caches = make(map[IndexKey]*IndexCache)

	// 删除本地文件
	return os.RemoveAll(im.localDir)
}

// Helper functions

func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 &&
		(s == substr ||
			len(s) > len(substr) &&
				(s[:len(substr)] == substr ||
					s[len(s)-len(substr):] == substr ||
					findSubstr(s, substr)))
}

func findSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// EnsureIndexes 确保所有配置的索引都存在
func (im *IndexManager) EnsureIndexes(ctx context.Context, syncMgr *SyncManager) error {
	if !im.repo.IsEnabled {
		return nil
	}

	var wg sync.WaitGroup
	errCh := make(chan error, len(im.repo.Branches)*len(im.repo.Repos)*len(im.repo.Archs))

	for _, branch := range im.repo.Branches {
		for _, repo := range im.repo.Repos {
			for _, arch := range im.repo.Archs {
				key := IndexKey{Branch: branch, Repo: repo, Arch: arch}
				cache := im.GetCache(key)

				// 不存在则同步
				if !cache.Exists() {
					wg.Add(1)
					go func(k IndexKey) {
						defer wg.Done()
						if err := syncMgr.SyncBlocking(ctx, k); err != nil {
							errCh <- fmt.Errorf("sync %s: %w", k, err)
						} else {
							im.UpdateCache(k, time.Now())
						}
					}(key)
				}
			}
		}
	}

	wg.Wait()
	close(errCh)

	// 收集错误
	var errs []error
	for err := range errCh {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to sync %d indexes", len(errs))
	}

	return nil
}
