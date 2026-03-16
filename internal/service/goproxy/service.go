package goproxy

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/goproxy/goproxy"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/service"
)

// Service 封装 goproxy，提供 Go 模块代理服务
type Service struct {
	dataDir     string
	settingSvc  *service.SettingService
	goAvailable bool // 标记系统是否安装了 go 命令

	mu        sync.RWMutex // 保护 proxy、upstream、goprivate 的并发读写
	proxy     *goproxy.Goproxy
	upstream  string
	goprivate string
}

// New 创建 Go 模块代理服务
func New(dataDir string, settingSvc *service.SettingService) *Service {
	// 检查系统是否安装了 go 命令
	goBin, err := exec.LookPath("go")
	goAvailable := err == nil
	if goAvailable {
		log.Printf("[go] found go command at: %s", goBin)
	} else {
		log.Println("[go] 'go' command not found, using pure HTTP proxy mode")
	}

	s := &Service{
		dataDir:     dataDir,
		settingSvc:  settingSvc,
		goAvailable: goAvailable,
		upstream:    settingSvc.GetGoUpstream(),
		goprivate:   settingSvc.GetGoPrivate(),
	}

	s.initProxy()

	// 监听配置变更，持锁更新字段后重新初始化 proxy
	settingSvc.OnChange(service.SettingGoUpstream, func(v string) {
		s.mu.Lock()
		s.upstream = v
		s.initProxyLocked()
		s.mu.Unlock()
		log.Printf("[go] upstream changed to: %s", v)
	})

	settingSvc.OnChange(service.SettingGoPrivate, func(v string) {
		s.mu.Lock()
		s.goprivate = v
		s.initProxyLocked()
		s.mu.Unlock()
		log.Printf("[go] goprivate changed to: %s", v)
	})

	return s
}

// initProxy 首次初始化（调用前无需加锁，New 尚未返回故无并发）
func (s *Service) initProxy() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.initProxyLocked()
}

// initProxyLocked 重新构建 goproxy 实例，调用方必须持有 s.mu 写锁
func (s *Service) initProxyLocked() {
	cacheDir := filepath.Join(s.dataDir, "go-cache")
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		log.Printf("[go] failed to create cache dir: %v", err)
	}

	upstream := s.upstream
	if upstream == "" {
		upstream = service.DefaultGoUpstream
	}

	// 创建自定义 Fetcher，根据 go 是否可用来决定行为
	var fetcher goproxy.Fetcher
	if s.goAvailable {
		// 使用 GoFetcher，支持本地构建和缓存
		env := append(
			os.Environ(),
			"GOPROXY="+upstream+",direct",
		)
		if s.goprivate != "" {
			env = append(env, "GOPRIVATE="+s.goprivate)
		}
		fetcher = &goproxy.GoFetcher{
			Env: env,
		}
		log.Println("[go] initialized with GoFetcher (full functionality)")
	} else {
		// 使用纯 HTTP 代理 Fetcher，转发到上游代理
		fetcher = newHTTPProxyFetcher(upstream, s.goprivate)
		log.Println("[go] initialized with HTTP proxy fetcher (pure proxy mode)")
	}

	s.proxy = &goproxy.Goproxy{
		Fetcher: fetcher,
		Cacher:  goproxy.DirCacher(cacheDir),
		ProxiedSumDBs: []string{
			"sum.golang.org https://goproxy.cn/sumdb/sum.golang.org",
		},
	}
}

// httpProxyFetcher 纯 HTTP 代理 Fetcher，转发请求到上游 Go 模块代理
type httpProxyFetcher struct {
	upstream  string
	goprivate string
	client    *http.Client
}

// newHTTPProxyFetcher 创建纯 HTTP 代理 Fetcher
func newHTTPProxyFetcher(upstream, goprivate string) *httpProxyFetcher {
	if upstream == "" || upstream == "direct" {
		upstream = "https://proxy.golang.org"
	}
	// 处理多个 upstream，取第一个
	if idx := strings.Index(upstream, ","); idx > 0 {
		upstream = upstream[:idx]
	}
	upstream = strings.TrimSpace(upstream)

	return &httpProxyFetcher{
		upstream:  upstream,
		goprivate: goprivate,
		client:    &http.Client{Timeout: 5 * time.Minute},
	}
}

// isPrivate 检查模块路径是否是私有模块
func (f *httpProxyFetcher) isPrivate(path string) bool {
	if f.goprivate == "" {
		return false
	}
	// 简单匹配，支持通配符
	patterns := strings.Split(f.goprivate, ",")
	for _, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		// 处理通配符
		if strings.HasSuffix(pattern, "/*") {
			prefix := pattern[:len(pattern)-2]
			if strings.HasPrefix(path, prefix+"/") || path == prefix {
				return true
			}
		} else if pattern == path || strings.HasPrefix(path, pattern+"/") {
			return true
		}
	}
	return false
}

// upstreamURL 构建上游请求 URL
func (f *httpProxyFetcher) upstreamURL(path string) string {
	base := strings.TrimSuffix(f.upstream, "/")
	return base + "/" + path
}

// List 获取模块的所有版本列表
// GET $GOPROXY/<module>/@v/list
func (f *httpProxyFetcher) List(ctx context.Context, path string) ([]string, error) {
	if f.isPrivate(path) {
		return nil, errors.New("private module not supported in pure proxy mode: " + path)
	}

	url := f.upstreamURL(path + "/@v/list")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			return nil, fs.ErrNotExist
		}
		return nil, fmt.Errorf("upstream returned %d", resp.StatusCode)
	}

	var versions []string
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		v := strings.TrimSpace(scanner.Text())
		if v != "" {
			versions = append(versions, v)
		}
	}
	return versions, scanner.Err()
}

// Query 查询模块版本
// GET $GOPROXY/<module>/@v/<query>.info
func (f *httpProxyFetcher) Query(ctx context.Context, path, query string) (string, time.Time, error) {
	if f.isPrivate(path) {
		return "", time.Time{}, errors.New("private module not supported in pure proxy mode: " + path)
	}

	// 处理 latest 查询
	if query == "latest" {
		url := f.upstreamURL(path + "/@latest")
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return "", time.Time{}, err
		}

		resp, err := f.client.Do(req)
		if err != nil {
			return "", time.Time{}, err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			if resp.StatusCode == http.StatusNotFound {
				return "", time.Time{}, fs.ErrNotExist
			}
			return "", time.Time{}, fmt.Errorf("upstream returned %d", resp.StatusCode)
		}

		// 解析 .info 文件
		var info struct {
			Version string    `json:"Version"`
			Time    time.Time `json:"Time"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
			return "", time.Time{}, err
		}
		return info.Version, info.Time, nil
	}

	// 其他查询直接获取 .info 文件
	url := f.upstreamURL(path + "/@v/" + query + ".info")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", time.Time{}, err
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return "", time.Time{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			return "", time.Time{}, fs.ErrNotExist
		}
		return "", time.Time{}, fmt.Errorf("upstream returned %d", resp.StatusCode)
	}

	var info struct {
		Version string    `json:"Version"`
		Time    time.Time `json:"Time"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", time.Time{}, err
	}
	return info.Version, info.Time, nil
}

// Download 下载模块文件
// GET $GOPROXY/<module>/@v/<version>.info
// GET $GOPROXY/<module>/@v/<version>.mod
// GET $GOPROXY/<module>/@v/<version>.zip
func (f *httpProxyFetcher) Download(ctx context.Context, path, version string) (info, mod, zip io.ReadSeekCloser, err error) {
	if f.isPrivate(path) {
		return nil, nil, nil, errors.New("private module not supported in pure proxy mode: " + path)
	}

	// 下载 .info 文件
	infoURL := f.upstreamURL(path + "/@v/" + version + ".info")
	infoData, err := f.downloadBytes(ctx, infoURL)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("download info: %w", err)
	}
	info = &readSeekCloser{bytes.NewReader(infoData)}

	// 下载 .mod 文件
	modURL := f.upstreamURL(path + "/@v/" + version + ".mod")
	modData, err := f.downloadBytes(ctx, modURL)
	if err != nil {
		info.Close()
		return nil, nil, nil, fmt.Errorf("download mod: %w", err)
	}
	mod = &readSeekCloser{bytes.NewReader(modData)}

	// 下载 .zip 文件
	zipURL := f.upstreamURL(path + "/@v/" + version + ".zip")
	zipData, err := f.downloadBytes(ctx, zipURL)
	if err != nil {
		info.Close()
		mod.Close()
		return nil, nil, nil, fmt.Errorf("download zip: %w", err)
	}
	zip = &readSeekCloser{bytes.NewReader(zipData)}

	return info, mod, zip, nil
}

// downloadBytes 下载 URL 内容到内存
func (f *httpProxyFetcher) downloadBytes(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			return nil, fs.ErrNotExist
		}
		return nil, fmt.Errorf("upstream returned %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// readSeekCloser 实现了 io.ReadSeekCloser 接口
type readSeekCloser struct {
	*bytes.Reader
}

func (r *readSeekCloser) Close() error {
	return nil
}

// ServeHTTP 实现 http.Handler 接口，持读锁读取 proxy 指针后转发请求
func (s *Service) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	p := s.proxy
	s.mu.RUnlock()
	p.ServeHTTP(w, r)
}

// GetCacheStats 返回缓存统计信息
func (s *Service) GetCacheStats() (map[string]interface{}, error) {
	cacheDir := filepath.Join(s.dataDir, "go-cache")

	var size int64
	var fileCount int

	err := filepath.Walk(cacheDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			size += info.Size()
			fileCount++
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	s.mu.RLock()
	upstream := s.upstream
	goprivate := s.goprivate
	goAvailable := s.goAvailable
	s.mu.RUnlock()

	mode := "full"
	if !goAvailable {
		mode = "http-proxy"
	}

	return map[string]interface{}{
		"cache_dir":    cacheDir,
		"size_bytes":   size,
		"file_count":   fileCount,
		"upstream":     upstream,
		"goprivate":    goprivate,
		"mode":         mode,
		"go_available": goAvailable,
	}, nil
}

// CleanCache 清理缓存目录
func (s *Service) CleanCache() error {
	cacheDir := filepath.Join(s.dataDir, "go-cache")
	return os.RemoveAll(cacheDir)
}

// IsGoAvailable 返回系统是否安装了 go 命令
func (s *Service) IsGoAvailable() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.goAvailable
}
