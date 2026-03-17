package alpine

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// SyncManager 索引同步管理器
type SyncManager struct {
	upstream   string      // 上游地址
	localDir   string      // 本地缓存目录
	parser     *IndexParser
	httpClient *http.Client

	// 并发控制
	mu         sync.RWMutex
	inProgress map[IndexKey]chan struct{} // 防止重复同步

	// 后台刷新控制
	refreshSem chan struct{} // 限制并发刷新数
}

// NewSyncManager 创建同步管理器
func NewSyncManager(upstream, localDir string) *SyncManager {
	if upstream == "" {
		upstream = "https://dl-cdn.alpinelinux.org/alpine"
	}

	return &SyncManager{
		upstream:   upstream,
		localDir:   localDir,
		parser:     NewIndexParser(),
		httpClient: &http.Client{Timeout: 5 * time.Minute},
		inProgress: make(map[IndexKey]chan struct{}),
		refreshSem: make(chan struct{}, 5), // 最多5个并发刷新
	}
}

// SyncBlocking 阻塞式同步（首次/强制刷新）
func (sm *SyncManager) SyncBlocking(ctx context.Context, key IndexKey) error {
	// 检查是否已在同步中
	sm.mu.Lock()
	if ch, ok := sm.inProgress[key]; ok {
		sm.mu.Unlock()
		// 等待正在进行的同步完成
		select {
		case <-ch:
			return nil // 同步完成
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	// 创建同步完成信号
	done := make(chan struct{})
	sm.inProgress[key] = done
	sm.mu.Unlock()

	// 确保清理
	defer func() {
		sm.mu.Lock()
		delete(sm.inProgress, key)
		close(done)
		sm.mu.Unlock()
	}()

	return sm.doSync(ctx, key)
}

// Sync 非阻塞同步（后台刷新）
func (sm *SyncManager) Sync(ctx context.Context, key IndexKey) error {
	// 检查是否已在同步中
	sm.mu.RLock()
	if _, ok := sm.inProgress[key]; ok {
		sm.mu.RUnlock()
		return nil // 已有同步在进行，跳过
	}
	sm.mu.RUnlock()
	
	return sm.doSync(ctx, key)
}

// doSync 执行实际同步
func (sm *SyncManager) doSync(ctx context.Context, key IndexKey) error {
	remoteURL := fmt.Sprintf("%s/%s/APKINDEX.tar.gz",
		sm.upstream, key.String())

	localDir := filepath.Join(sm.localDir, key.Branch, key.Repo, key.Arch)
	localPath := filepath.Join(localDir, "APKINDEX.tar.gz")

	// 创建目录
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 下载
	if err := sm.download(ctx, remoteURL, localPath); err != nil {
		return fmt.Errorf("failed to download: %w", err)
	}

	log.Printf("[alpine] synced index: %s", key)
	return nil
}

// download 带条件请求的下载
func (sm *SyncManager) download(ctx context.Context, url, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	// 设置条件请求头
	if fi, err := os.Stat(path); err == nil {
		req.Header.Set("If-Modified-Since", fi.ModTime().UTC().Format(http.TimeFormat))
	}

	resp, err := sm.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// 304 Not Modified
	if resp.StatusCode == http.StatusNotModified {
		log.Printf("[alpine] index not modified: %s", url)
		return nil
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("upstream returned %d", resp.StatusCode)
	}

	// 写入临时文件
	tmpPath := path + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return err
	}

	_, err = io.Copy(f, resp.Body)
	f.Close()

	if err != nil {
		os.Remove(tmpPath)
		return err
	}

	// 原子替换
	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return err
	}

	return nil
}

// SyncPackage 同步单个包文件
func (sm *SyncManager) SyncPackage(ctx context.Context, key IndexKey, pkgName, pkgVersion string) (string, error) {
	pkgFile := fmt.Sprintf("%s-%s.apk", pkgName, pkgVersion)
	remoteURL := fmt.Sprintf("%s/%s/%s",
		sm.upstream, key.String(), pkgFile)

	localDir := filepath.Join(sm.localDir, key.Branch, key.Repo, key.Arch, "packages")
	localPath := filepath.Join(localDir, pkgFile)

	// 已存在直接返回
	if _, err := os.Stat(localPath); err == nil {
		return localPath, nil
	}

	// 创建目录
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return "", err
	}

	// 下载
	if err := sm.download(ctx, remoteURL, localPath); err != nil {
		return "", err
	}

	log.Printf("[alpine] cached package: %s/%s", key, pkgFile)
	return localPath, nil
}

// GetPackagePath 获取包文件本地路径（如果不存在返回空）
func (sm *SyncManager) GetPackagePath(key IndexKey, pkgName, pkgVersion string) string {
	pkgFile := fmt.Sprintf("%s-%s.apk", pkgName, pkgVersion)
	path := filepath.Join(sm.localDir, key.Branch, key.Repo, key.Arch, "packages", pkgFile)

	if _, err := os.Stat(path); err == nil {
		return path
	}
	return ""
}

// SyncScheduler 定时同步调度器
type SyncScheduler struct {
	interval  time.Duration
	ticker    *time.Ticker
	stopCh    chan struct{}
	syncMgr   *SyncManager
	repo      *Repository
}

// NewSyncScheduler 创建定时调度器
func NewSyncScheduler(interval time.Duration, syncMgr *SyncManager, repo *Repository) *SyncScheduler {
	if interval == 0 {
		interval = 30 * time.Minute
	}
	return &SyncScheduler{
		interval: interval,
		stopCh:   make(chan struct{}),
		syncMgr:  syncMgr,
		repo:     repo,
	}
}

// Start 启动定时同步
func (ss *SyncScheduler) Start(ctx context.Context) {
	ss.ticker = time.NewTicker(ss.interval)

	go func() {
		// 立即执行一次
		ss.syncAll(ctx)

		for {
			select {
			case <-ss.ticker.C:
				log.Println("[alpine] scheduled sync started")
				ss.syncAll(ctx)

			case <-ss.stopCh:
				ss.ticker.Stop()
				return

			case <-ctx.Done():
				ss.ticker.Stop()
				return
			}
		}
	}()
}

// Stop 停止定时同步
func (ss *SyncScheduler) Stop() {
	close(ss.stopCh)
}

// TriggerSync 手动触发全量同步
func (ss *SyncScheduler) TriggerSync() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	ss.syncAll(ctx)
}

// syncAll 同步所有索引
func (ss *SyncScheduler) syncAll(ctx context.Context) {
	if !ss.repo.IsEnabled {
		return
	}

	for _, branch := range ss.repo.Branches {
		for _, repo := range ss.repo.Repos {
			for _, arch := range ss.repo.Archs {
				key := IndexKey{
					Branch: branch,
					Repo:   repo,
					Arch:   arch,
				}

				// 异步执行
				go func(k IndexKey) {
					if err := ss.syncMgr.Sync(ctx, k); err != nil {
						log.Printf("[alpine] sync failed %s: %v", k, err)
					}
				}(key)
			}
		}
	}
}
