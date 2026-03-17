package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/loveuer/ursa"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/api/middleware"
	"gitea.loveuer.com/loveuer/uranus/v2/internal/service/alpine"
)

// sendFile 发送文件响应
func sendFile(c *ursa.Ctx, path string) error {
	http.ServeFile(c.Writer, c.Request, path)
	return nil
}

// AlpineHandler Alpine APK 代理处理器
type AlpineHandler struct {
	indexMgr   *alpine.IndexManager
	syncMgr    *alpine.SyncManager
	scheduler  *alpine.SyncScheduler
	localDir   string
	refreshSem chan struct{} // 后台刷新信号量
}

// NewAlpineHandler 创建处理器
func NewAlpineHandler(dataDir string) *AlpineHandler {
	localDir := filepath.Join(dataDir, "alpine")
	repo := alpine.DefaultRepository()

	indexMgr := alpine.NewIndexManager(localDir, repo)
	syncMgr := alpine.NewSyncManager(repo.UpstreamURL, localDir)
	scheduler := alpine.NewSyncScheduler(repo.SyncInterval, syncMgr, repo)

	h := &AlpineHandler{
		indexMgr:   indexMgr,
		syncMgr:    syncMgr,
		scheduler:  scheduler,
		localDir:   localDir,
		refreshSem: make(chan struct{}, 5),
	}

	// 启动定时同步
	scheduler.Start(context.Background())

	// 后台初始化索引
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		if err := indexMgr.EnsureIndexes(ctx, syncMgr); err != nil {
			log.Printf("[alpine] failed to ensure indexes: %v", err)
		}
	}()

	return h
}

// GetAPKINDEX 获取索引文件（核心代理接口）
// GET /alpine/:branch/:repo/:arch/APKINDEX.tar.gz
func (h *AlpineHandler) GetAPKINDEX(c *ursa.Ctx) error {
	key := alpine.IndexKey{
		Branch: c.Param("branch"),
		Repo:   c.Param("repo"),
		Arch:   c.Param("arch"),
	}

	// 1. 获取缓存
	cache := h.indexMgr.GetCache(key)

	// 2. 判断同步策略
	switch {
	case !cache.Exists():
		// 首次请求，阻塞同步
		log.Printf("[alpine] cache miss for %s, syncing...", key)
		if err := h.syncMgr.SyncBlocking(c.Request.Context(), key); err != nil {
			return c.Status(502).JSON(ursa.Map{
				"error": "sync failed: " + err.Error(),
			})
		}
		h.indexMgr.UpdateCache(key, time.Now())
		c.Set("X-Cache", "MISS")

	case cache.IsExpired(30 * time.Minute):
		// 缓存过期30分钟，强制同步
		log.Printf("[alpine] cache expired for %s, syncing...", key)
		if err := h.syncMgr.SyncBlocking(c.Request.Context(), key); err != nil {
			// 同步失败但缓存可用，返回缓存+警告
			c.Set("X-Cache-Stale", "true")
			c.Set("X-Sync-Error", err.Error())
			return sendFile(c, cache.LocalPath)
		}
		h.indexMgr.UpdateCache(key, time.Now())
		c.Set("X-Cache", "REVALIDATED")

	case cache.IsExpired(5 * time.Minute):
		// 缓存过期5分钟，后台刷新，立即返回缓存
		log.Printf("[alpine] cache stale for %s, background refresh", key)
		h.triggerBackgroundRefresh(key)
		c.Set("X-Cache", "HIT")
		c.Set("X-Background-Refresh", "true")
		return sendFile(c, cache.LocalPath)

	default:
		// 缓存新鲜
		c.Set("X-Cache", "HIT")
	}

	// 返回缓存文件
	return sendFile(c, cache.LocalPath)
}

// GetPackage 获取包文件（代理下载）
// GET /alpine/:branch/:repo/:arch/:package.apk
func (h *AlpineHandler) GetPackage(c *ursa.Ctx) error {
	key := alpine.IndexKey{
		Branch: c.Param("branch"),
		Repo:   c.Param("repo"),
		Arch:   c.Param("arch"),
	}
	pkgFile := c.Param("file")

	// 1. 检查本地缓存
	localPath := filepath.Join(h.localDir, key.Branch, key.Repo, key.Arch, "packages", pkgFile)
	if _, err := os.Stat(localPath); err == nil {
		c.Set("X-Cache", "HIT")
		return sendFile(c, localPath)
	}

	// 2. 从上游下载
	ctx := c.Request.Context()
	remoteURL := fmt.Sprintf("%s/%s/%s",
		alpine.DefaultRepository().UpstreamURL, key.String(), pkgFile)

	log.Printf("[alpine] downloading package: %s", pkgFile)

	// 创建目录
	pkgDir := filepath.Dir(localPath)
	if err := os.MkdirAll(pkgDir, 0755); err != nil {
		return c.Status(500).JSON(ursa.Map{"error": err.Error()})
	}

	// 下载文件
	if err := h.downloadFile(ctx, remoteURL, localPath); err != nil {
		return c.Status(502).JSON(ursa.Map{"error": "download failed: " + err.Error()})
	}

	c.Set("X-Cache", "MISS")
	return sendFile(c, localPath)
}

// ListPackages 列出所有包（API）
// GET /api/v1/alpine/packages?branch=v3.19&repo=main&arch=x86_64
func (h *AlpineHandler) ListPackages(c *ursa.Ctx) error {
	key := alpine.IndexKey{
		Branch: c.Query("branch", "v3.19"),
		Repo:   c.Query("repo", "main"),
		Arch:   c.Query("arch", "x86_64"),
	}

	packages := h.indexMgr.ListPackages(key)

	return c.JSON(ursa.Map{
		"code":    0,
		"message": "success",
		"data":    packages,
	})
}

// SearchPackages 搜索包（API）
// GET /api/v1/alpine/packages/search?q=nginx
func (h *AlpineHandler) SearchPackages(c *ursa.Ctx) error {
	key := alpine.IndexKey{
		Branch: c.Query("branch", "v3.19"),
		Repo:   c.Query("repo", "main"),
		Arch:   c.Query("arch", "x86_64"),
	}
	query := c.Query("q", "")

	if query == "" {
		return c.Status(400).JSON(ursa.Map{
			"code":    400,
			"message": "query parameter 'q' is required",
		})
	}

	packages := h.indexMgr.SearchPackages(key, query)

	return c.JSON(ursa.Map{
		"code":    0,
		"message": "success",
		"data":    packages,
	})
}

// GetPackageInfo 获取包详情（API）
// GET /api/v1/alpine/packages/:name
func (h *AlpineHandler) GetPackageInfo(c *ursa.Ctx) error {
	key := alpine.IndexKey{
		Branch: c.Query("branch", "v3.19"),
		Repo:   c.Query("repo", "main"),
		Arch:   c.Query("arch", "x86_64"),
	}
	name := c.Param("name")

	pkg, ok := h.indexMgr.GetPackage(key, name)
	if !ok {
		return c.Status(404).JSON(ursa.Map{
			"code":    404,
			"message": "package not found",
		})
	}

	return c.JSON(ursa.Map{
		"code":    0,
		"message": "success",
		"data":    pkg,
	})
}

// TriggerSync 手动触发同步（API）
// POST /api/v1/alpine/sync
func (h *AlpineHandler) TriggerSync(c *ursa.Ctx) error {
	// 检查管理员权限
	if !middleware.IsAdmin(c) {
		return c.Status(403).JSON(ursa.Map{
			"code":    403,
			"message": "admin required",
		})
	}

	key := alpine.IndexKey{
		Branch: c.Query("branch", ""),
		Repo:   c.Query("repo", ""),
		Arch:   c.Query("arch", ""),
	}

	// 如果指定了完整 key，同步单个索引
	if key.Branch != "" && key.Repo != "" && key.Arch != "" {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()
			if err := h.syncMgr.SyncBlocking(ctx, key); err != nil {
				log.Printf("[alpine] manual sync failed: %v", err)
			} else {
				h.indexMgr.UpdateCache(key, time.Now())
				log.Printf("[alpine] manual sync success: %s", key)
			}
		}()

		return c.JSON(ursa.Map{
			"code":    0,
			"message": "sync started",
		})
	}

	// 否则触发全量同步
	go h.scheduler.TriggerSync()

	return c.JSON(ursa.Map{
		"code":    0,
		"message": "full sync started",
	})
}

// GetStats 获取统计信息（API）
// GET /api/v1/alpine/stats
func (h *AlpineHandler) GetStats(c *ursa.Ctx) error {
	stats := h.indexMgr.GetStats()

	return c.JSON(ursa.Map{
		"code":    0,
		"message": "success",
		"data":    stats,
	})
}

// CleanCache 清理缓存（API）
// DELETE /api/v1/alpine/cache
func (h *AlpineHandler) CleanCache(c *ursa.Ctx) error {
	// 检查管理员权限
	if !middleware.IsAdmin(c) {
		return c.Status(403).JSON(ursa.Map{
			"code":    403,
			"message": "admin required",
		})
	}

	if err := h.indexMgr.CleanCache(); err != nil {
		return c.Status(500).JSON(ursa.Map{
			"code":    500,
			"message": err.Error(),
		})
	}

	return c.JSON(ursa.Map{
		"code":    0,
		"message": "cache cleaned",
	})
}

// triggerBackgroundRefresh 触发后台刷新
func (h *AlpineHandler) triggerBackgroundRefresh(key alpine.IndexKey) {
	select {
	case h.refreshSem <- struct{}{}:
		go func() {
			defer func() { <-h.refreshSem }()

			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()

			if err := h.syncMgr.Sync(ctx, key); err != nil {
				log.Printf("[alpine] background refresh failed: %v", err)
			} else {
				h.indexMgr.UpdateCache(key, time.Now())
				log.Printf("[alpine] background refresh success: %s", key)
			}
		}()
	default:
		log.Printf("[alpine] background refresh skipped (max concurrency)")
	}
}

// downloadFile 下载文件
func (h *AlpineHandler) downloadFile(ctx context.Context, url, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("upstream returned %d", resp.StatusCode)
	}

	// 写入临时文件
	tmpPath := path + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return err
	}

	_, err = f.ReadFrom(resp.Body)
	f.Close()

	if err != nil {
		os.Remove(tmpPath)
		return err
	}

	// 原子替换
	return os.Rename(tmpPath, path)
}
