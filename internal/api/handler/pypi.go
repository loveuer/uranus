package handler

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/loveuer/ursa"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/service"
	"gitea.loveuer.com/loveuer/uranus/v2/internal/service/pypi"
	"gorm.io/gorm"
)

// PyPIHandler PyPI 仓库 HTTP 处理器
type PyPIHandler struct {
	service *pypi.Service
	authSvc *service.AuthService
}

// NewPyPIHandler 创建 PyPI 处理器
func NewPyPIHandler(service *pypi.Service, authSvc *service.AuthService) *PyPIHandler {
	return &PyPIHandler{
		service: service,
		authSvc: authSvc,
	}
}

// GetSimpleIndex 处理 Simple API 索引请求（PEP 503）
// GET /simple/ - 返回所有包列表
// GET /simple/{package}/ - 返回特定包的所有版本
func (h *PyPIHandler) GetSimpleIndex(c *ursa.Ctx) error {
	name := c.Param("name")
	
	if name == "" {
		// 返回所有包列表
		packages, err := h.service.GetPackageList(c.Request.Context())
		if err != nil {
			return c.Status(http.StatusInternalServerError).SendString(err.Error())
		}
		
		// 生成 HTML（PEP 503 格式）
		html := "<!DOCTYPE html>\n<html><head><title>Simple Index</title></head><body>\n"
		for _, pkg := range packages {
			normalizedName := normalizePackageNameForURL(pkg.Name)
			html += fmt.Sprintf("<a href=\"/simple/%s/\">%s</a><br/>\n", normalizedName, pkg.Name)
		}
		html += "</body></html>"
		
		// 使用 HTML 格式返回
		return c.Status(http.StatusOK).HTML(html)
	}
	
	// 返回特定包的版本列表
	return h.getPackageVersions(c, name)
}

// getPackageVersions 获取包的所有版本（Simple API HTML 格式）
func (h *PyPIHandler) getPackageVersions(c *ursa.Ctx, name string) error {
	pkg, err := h.service.GetPackageVersions(c.Request.Context(), name)
	if err != nil {
		return c.Status(http.StatusNotFound).SendString("Package not found")
	}

	// 加载所有版本的文件
	var allFiles []struct {
		Version  string
		Filename string
		MD5      string
		SHA256   string
		Size     int64
	}

	for _, ver := range pkg.Versions {
		for _, file := range ver.Files {
			allFiles = append(allFiles, struct {
				Version  string
				Filename string
				MD5      string
				SHA256   string
				Size     int64
			}{
				Version:  ver.Version,
				Filename: file.Filename,
				MD5:      file.MD5,
				SHA256:   file.SHA256,
				Size:     file.Size,
			})
		}
	}

	// 按版本号排序
	sort.Slice(allFiles, func(i, j int) bool {
		return allFiles[i].Version < allFiles[j].Version
	})

	// 生成 HTML（PEP 503 格式）
	// 使用指向我们服务器的相对 URL，这样 pip 就会通过我们的代理下载
	html := "<!DOCTYPE html>\n<html><head><title>Links for " + pkg.Name + "</title></head><body>\n"
	html += fmt.Sprintf("<h1>Links for %s</h1>\n", pkg.Name)

	for _, f := range allFiles {
		// 使用指向我们服务器的相对路径，实现代理下载
		fileURL := fmt.Sprintf("/packages/%s/%s", url.PathEscape(pkg.Name), url.PathEscape(f.Filename))

		// 添加 hash 作为 anchor 用于 pip 验证
		if len(f.SHA256) >= 2 {
			html += fmt.Sprintf("<a href=\"%s#sha256=%s\">%s</a><br/>\n", fileURL, f.SHA256, f.Filename)
		} else {
			html += fmt.Sprintf("<a href=\"%s\">%s</a><br/>\n", fileURL, f.Filename)
		}
	}

	html += "</body></html>"

	// 使用 HTML 格式返回
	return c.Status(http.StatusOK).HTML(html)
}

// GetPackageFile 处理包文件下载请求
// GET /packages/{name}/{filename}
// 实现代理下载：从上游获取并转发
func (h *PyPIHandler) GetPackageFile(c *ursa.Ctx) error {
	name := c.Param("name")
	filename := c.Param("filename")
	
	if name == "" || filename == "" {
		return c.Status(http.StatusBadRequest).SendString("Missing package name or filename")
	}
	
	// 使用 service 的方法获取文件（service 已经有完整的代理逻辑）
	reader, size, err := h.service.GetPackageFile(c.Request.Context(), name, filename)
	if err != nil {
		if err == pypi.ErrFileNotFound {
			return c.Status(http.StatusNotFound).SendString("File not found")
		}
		return c.Status(http.StatusInternalServerError).SendString(err.Error())
	}
	defer reader.Close()
	
	// 设置响应头
	contentType := detectPackageContentType(filename)
	c.Set("Content-Type", contentType)
	c.Set("Content-Length", strconv.FormatInt(size, 10))
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	
	// 传输文件
	_, err = io.Copy(c.Writer, reader)
	return err
}

// detectPackageContentType 根据文件名检测包文件类型
func detectPackageContentType(filename string) string {
	ext := filepath.Ext(filename)
	switch ext {
	case ".whl":
		return "application/zip" // wheel 文件本质是 zip
	case ".tar.gz":
		return "application/gzip"
	case ".zip":
		return "application/zip"
	case ".egg":
		return "application/zip"
	default:
		return "application/octet-stream"
	}
}

// normalizePackageNameForURL 标准化包名用于 URL
func normalizePackageNameForURL(name string) string {
	name = strings.ToLower(name)
	name = strings.ReplaceAll(name, "_", "-")
	name = strings.ReplaceAll(name, ".", "-")
	return name
}

// normalizePackageName 标准化包名
func normalizePackageName(name string) string {
	return normalizePackageNameForURL(name)
}

// ListPackages 列出所有包（API 接口）
func (h *PyPIHandler) ListPackages(c *ursa.Ctx) error {
	limitStr := c.Query("limit", "20")
	offsetStr := c.Query("offset", "0")
	
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)
	
	packages, total, err := h.service.ListPackages(c.Request.Context(), limit, offset)
	if err != nil {
		return c.Status(http.StatusInternalServerError).SendString(err.Error())
	}
	
	return c.JSON(map[string]interface{}{
		"packages": packages,
		"total":    total,
	})
}

// GetPackageDetail 获取包的详细信息
func (h *PyPIHandler) GetPackageDetail(c *ursa.Ctx) error {
	name := c.Param("name")
	
	pkg, err := h.service.GetPackageVersions(c.Request.Context(), name)
	if err != nil {
		return c.Status(http.StatusNotFound).SendString("Package not found")
	}
	
	return c.JSON(pkg)
}

// UploadPackage 处理 PyPI 包上传（twine upload）
// POST /legacy/
func (h *PyPIHandler) UploadPackage(c *ursa.Ctx) error {
	// 解析 multipart/form-data
	err := c.Request.ParseMultipartForm(50 << 20) // 50MB limit
	if err != nil {
		return c.Status(http.StatusBadRequest).SendString("Invalid form data")
	}
	
	// 获取文件
	file, header, err := c.Request.FormFile("content")
	if err != nil {
		return c.Status(http.StatusBadRequest).SendString("Missing content file")
	}
	defer file.Close()
	
	// 读取文件内容
	fileData := make([]byte, header.Size)
	_, err = file.Read(fileData)
	if err != nil {
		return c.Status(http.StatusInternalServerError).SendString("Failed to read file")
	}
	
	// 获取上传者信息（从认证上下文）
	uploaderID := uint(0)
	uploader := "anonymous"
	
	// 上传包
	filename := header.Filename
	if err := h.service.UploadPackage(c.Request.Context(), filename, fileData, uploaderID, uploader); err != nil {
		if strings.Contains(err.Error(), "already exists") {
			return c.Status(http.StatusConflict).SendString(err.Error())
		}
		return c.Status(http.StatusInternalServerError).SendString(err.Error())
	}
	
	return c.Status(http.StatusCreated).SendString("Package uploaded successfully")
}

// DeletePackage 删除包
func (h *PyPIHandler) DeletePackage(c *ursa.Ctx) error {
	name := c.Param("name")
	
	if err := h.service.DeletePackage(c.Request.Context(), name); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(http.StatusNotFound).SendString("Package not found")
		}
		return c.Status(http.StatusInternalServerError).SendString(err.Error())
	}
	
	return c.SendString("Package deleted successfully")
}

// DeleteVersion 删除版本
func (h *PyPIHandler) DeleteVersion(c *ursa.Ctx) error {
	name := c.Param("name")
	version := c.Param("version")
	
	if err := h.service.DeleteVersion(c.Request.Context(), name, version); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(http.StatusNotFound).SendString("Version not found")
		}
		return c.Status(http.StatusInternalServerError).SendString(err.Error())
	}
	
	return c.SendString("Version deleted successfully")
}

// GetStats 获取缓存统计信息
func (h *PyPIHandler) GetStats(c *ursa.Ctx) error {
	stats, err := h.service.GetCacheStats(c.Request.Context())
	if err != nil {
		return c.Status(http.StatusInternalServerError).SendString(err.Error())
	}
	
	return c.JSON(stats)
}

// CleanCache 清理缓存
func (h *PyPIHandler) CleanCache(c *ursa.Ctx) error {
	count, err := h.service.CleanCache(c.Request.Context())
	if err != nil {
		return c.Status(http.StatusInternalServerError).SendString(err.Error())
	}
	
	return c.JSON(map[string]interface{}{
		"deleted_count": count,
	})
}
