package pypi

import (
	"bytes"
	"context"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/model"
	"gitea.loveuer.com/loveuer/uranus/v2/internal/service"
)

var (
	ErrPackageNotFound   = errors.New("package not found")
	ErrFileNotFound      = errors.New("file not found")
	ErrVersionExists     = errors.New("version already exists")
	ErrInvalidFilename   = errors.New("invalid filename format")
)

// Service PyPI 仓库服务
type Service struct {
	db         *gorm.DB
	dataDir    string
	settingSvc *service.SettingService
	httpClient *http.Client
}

// New 创建 PyPI 服务实例
func New(db *gorm.DB, dataDir string, settingSvc *service.SettingService) *Service {
	return &Service{
		db:         db,
		dataDir:    filepath.Join(dataDir, "pypi"),
		settingSvc: settingSvc,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // PyPI 文件可能较大，设置更长超时
		},
	}
}

// HttpClient 返回 HTTP 客户端
func (s *Service) HttpClient() *http.Client {
	return s.httpClient
}

// upstream 获取上游 PyPI 地址
func (s *Service) upstream() string {
	upstream := s.settingSvc.GetPyPIUpstream()
	if upstream == "" {
		return "https://pypi.org"
	}
	return upstream
}

// ensureDir 确保目录存在
func ensureDir(path string) error {
	return os.MkdirAll(path, 0755)
}

// normalizePackageName 标准化包名（PEP 503）
// 将大写转换为小写，_和.替换为-
func normalizePackageName(name string) string {
	name = strings.ToLower(name)
	name = strings.ReplaceAll(name, "_", "-")
	name = strings.ReplaceAll(name, ".", "-")
	return name
}

// parseFilename 解析 Python 包文件名
// wheel 格式：{distribution}-{version}(-{build})?-{python}-{abi}-{platform}.whl
// sdist 格式：{distribution}-{version}.tar.gz
func parseFilename(filename string) (dist, version, packagetype string, err error) {
	if strings.HasSuffix(filename, ".whl") {
		packagetype = "bdist_wheel"
		baseName := strings.TrimSuffix(filename, ".whl")
		parts := strings.Split(baseName, "-")
		if len(parts) < 5 {
			return "", "", "", ErrInvalidFilename
		}
		dist = parts[0]
		version = parts[1]
		return dist, version, packagetype, nil
	} else if strings.HasSuffix(filename, ".tar.gz") {
		packagetype = "sdist"
		baseName := strings.TrimSuffix(filename, ".tar.gz")
		parts := strings.Split(baseName, "-")
		if len(parts) < 2 {
			return "", "", "", ErrInvalidFilename
		}
		dist = parts[0]
		version = parts[len(parts)-1]
		return dist, version, packagetype, nil
	} else if strings.HasSuffix(filename, ".zip") {
		packagetype = "sdist"
		baseName := strings.TrimSuffix(filename, ".zip")
		parts := strings.Split(baseName, "-")
		if len(parts) < 2 {
			return "", "", "", ErrInvalidFilename
		}
		dist = parts[0]
		version = parts[len(parts)-1]
		return dist, version, packagetype, nil
	}
	return "", "", "", ErrInvalidFilename
}

// packagePath 计算包在磁盘上的存储路径
func (s *Service) packagePath(normalizedName string) string {
	return filepath.Join(s.dataDir, normalizedName)
}

// fileStoragePath 计算文件在磁盘上的存储路径
func (s *Service) fileStoragePath(normalizedName, filename string) string {
	return filepath.Join(s.packagePath(normalizedName), filename)
}

// calculateMD5 计算文件的 MD5
func calculateMD5(r io.Reader) (string, error) {
	h := md5.New()
	if _, err := io.Copy(h, r); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// calculateSHA256 计算文件的 SHA256
func calculateSHA256(r io.Reader) (string, error) {
	h := sha256.New()
	if _, err := io.Copy(h, r); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// fileExists 检查文件是否存在
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// GetPackageList 获取包列表（Simple API）
func (s *Service) GetPackageList(ctx context.Context) ([]model.PyPIPackage, error) {
	var packages []model.PyPIPackage
	
	err := s.db.WithContext(ctx).Find(&packages).Error
	if err != nil {
		return nil, err
	}
	
	// 如果本地没有包，尝试从上游获取热门包列表
	if len(packages) == 0 {
		if err := s.FetchPopularPackages(ctx); err != nil {
			// 返回空列表而不是错误
			return []model.PyPIPackage{}, nil
		}
		// 重新查询
		err = s.db.WithContext(ctx).Find(&packages).Error
		if err != nil {
			return nil, err
		}
	}
	
	return packages, nil
}

// GetPackageVersions 获取包的所有版本
func (s *Service) GetPackageVersions(ctx context.Context, name string) (*model.PyPIPackage, error) {
	normalizedName := normalizePackageName(name)
	
	var pkg model.PyPIPackage
	err := s.db.WithContext(ctx).Where("name = ?", normalizedName).First(&pkg).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 本地没有，尝试从上游获取
			if fetchErr := s.FetchAndSavePackageVersions(ctx, normalizedName); fetchErr != nil {
				return nil, ErrPackageNotFound
			}
			// 重新查询
			err = s.db.WithContext(ctx).Where("name = ?", normalizedName).First(&pkg).Error
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}
	
	// 检查是否需要从上游获取版本
	var versions []model.PyPIVersion
	err = s.db.WithContext(ctx).Preload("Files").Where("package_id = ?", pkg.ID).Find(&versions).Error
	if err == nil && len(versions) == 0 {
		// 没有版本，尝试从上游获取
		if fetchErr := s.FetchAndSavePackageVersions(ctx, normalizedName); fetchErr != nil {
		} else {
			// 重新查询版本
			err = s.db.WithContext(ctx).Where("package_id = ?", pkg.ID).Find(&versions).Error
		}
	}
	
	if err == nil {
		pkg.Versions = versions
	}
	
	return &pkg, nil
}

// GetPackageFile 获取包文件，优先从本地缓存获取，不存在则从上游代理
func (s *Service) GetPackageFile(ctx context.Context, name, filename string) (io.ReadCloser, int64, error) {
	normalizedName := normalizePackageName(name)
	localPath := s.fileStoragePath(normalizedName, filename)

	// 1. 检查本地缓存
	if fileExists(localPath) {
		file, err := os.Open(localPath)
		if err != nil {
			return nil, 0, err
		}
		stat, _ := file.Stat()
		return file, stat.Size(), nil
	}

	// 2. 从上游代理 - 会自动从 Simple API 获取正确的 URL
	return s.proxyFromUpstream(ctx, name, filename, localPath)
}

// proxyFromUpstream 从上游获取文件并缓存
func (s *Service) proxyFromUpstream(ctx context.Context, name, filename, localPath string) (io.ReadCloser, int64, error) {
	normalizedName := normalizePackageName(name)

	// 从上游 Simple API 获取正确的文件 URL
	upstreamURL := s.upstream()
	simpleAPIURL := fmt.Sprintf("%s/simple/%s/", upstreamURL, normalizedName)

	fmt.Printf("[DEBUG] proxyFromUpstream: fetching file list from %s\n", simpleAPIURL)

	// 获取 Simple API 页面以找到正确的文件 URL
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, simpleAPIURL, nil)
	if err != nil {
		return nil, 0, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("upstream simple API returned status %d", resp.StatusCode)
	}

	// 解析 HTML 找到正确的文件 URL
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}

	// 查找包含目标文件名的链接
	targetURL := s.extractFileURL(string(body), filename)
	if targetURL == "" {
		return nil, 0, ErrFileNotFound
	}

	fmt.Printf("[DEBUG] proxyFromUpstream: name=%s, filename=%s, upstream_url=%s\n", name, filename, targetURL)

	// 使用从 Simple API 获取的 URL 下载文件
	req, err = http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, 0, err
	}

	resp, err = s.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == http.StatusNotFound {
		return nil, 0, ErrFileNotFound
	}
	
	if resp.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("upstream returned status %d", resp.StatusCode)
	}
	
	// 成功响应
	if err := ensureDir(filepath.Dir(localPath)); err != nil {
		resp.Body.Close()
		return nil, 0, err
	}
	
	// 创建临时文件
	tmpPath := localPath + ".tmp"
	tmpFile, err := os.Create(tmpPath)
	if err != nil {
		resp.Body.Close()
			return nil, 0, err
		}
		
		// 同时写入文件和计算哈希
		teeReader := io.TeeReader(resp.Body, tmpFile)
		md5Hash := md5.New()
		sha256Hash := sha256.New()
		multiWriter := io.MultiWriter(md5Hash, sha256Hash)
		size, err := io.Copy(multiWriter, teeReader)
		if err != nil {
			tmpFile.Close()
			os.Remove(tmpPath)
			resp.Body.Close()
			return nil, 0, err
		}
		
		tmpFile.Close()
		resp.Body.Close()
		
		// 重命名为最终文件
		if err := os.Rename(tmpPath, localPath); err != nil {
			os.Remove(tmpPath)
			return nil, 0, err
		}
		
		// 保存校验和文件
		md5Value := hex.EncodeToString(md5Hash.Sum(nil))
		sha256Value := hex.EncodeToString(sha256Hash.Sum(nil))
		os.WriteFile(localPath+".md5", []byte(md5Value), 0644)
		os.WriteFile(localPath+".sha256", []byte(sha256Value), 0644)
		
		// 记录到数据库（异步）
		go s.recordPackageFile(name, filename, size, md5Value, sha256Value)
		
		// 重新打开文件供读取
		file, err := os.Open(localPath)
		if err != nil {
			return nil, 0, err
		}
		
		return file, size, nil
	}
	
	// recordPackageFile 记录包文件信息到数据库
func (s *Service) recordPackageFile(name, filename string, size int64, md5Sum, sha256Sum string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	normalizedName := normalizePackageName(name)
	
	// 解析文件名
	_, version, packagetype, err := parseFilename(filename)
	if err != nil {
		return
	}
	
	// 查找或创建 package
	var pkg model.PyPIPackage
	err = s.db.WithContext(ctx).Where("name = ?", normalizedName).First(&pkg).Error
	
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			pkg = model.PyPIPackage{
				Name:       normalizedName,
				IsUploaded: false,
			}
			if err := s.db.WithContext(ctx).Create(&pkg).Error; err != nil {
				return
			}
		} else {
			return
		}
	}
	
	// 查找或创建 version
	var ver model.PyPIVersion
	err = s.db.WithContext(ctx).Where("package_id = ? AND version = ?", pkg.ID, version).First(&ver).Error
	
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ver = model.PyPIVersion{
				PackageID: pkg.ID,
				Version:   version,
			}
			if err := s.db.WithContext(ctx).Create(&ver).Error; err != nil {
				return
			}
		} else {
			return
		}
	}
	
	// 提取 python_version 和 platform 信息（从文件名）
	pythonVersion := ""
	platform := ""
	
	if packagetype == "bdist_wheel" {
		// wheel 文件名格式：{dist}-{version}-{python}-{abi}-{platform}.whl
		baseName := strings.TrimSuffix(filename, ".whl")
		parts := strings.Split(baseName, "-")
		if len(parts) >= 5 {
			pythonVersion = parts[2]
			platform = parts[4]
		}
	} else {
		pythonVersion = "source"
		platform = "any"
	}
	
	// 查找或创建 file 记录
	var file model.PyPIFile
	err = s.db.WithContext(ctx).Where("version_id = ? AND filename = ?", ver.ID, filename).First(&file).Error
	
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			file = model.PyPIFile{
				VersionID:       ver.ID,
				Filename:        filename,
				Path:            s.fileStoragePath(normalizedName, filename),
				Size:            size,
				MD5:             md5Sum,
				SHA256:          sha256Sum,
				Packagetype:     packagetype,
				PythonVersion:   pythonVersion,
				Platform:        platform,
				Cached:          true,
				IsUploaded:      false,
			}
			s.db.WithContext(ctx).Create(&file)
		}
	}
}

// ListPackages 列出所有包
func (s *Service) ListPackages(ctx context.Context, limit, offset int) ([]model.PyPIPackage, int64, error) {
	var packages []model.PyPIPackage
	var total int64
	
	tx := s.db.WithContext(ctx).Model(&model.PyPIPackage{})
	tx.Count(&total)
	
	err := tx.Limit(limit).Offset(offset).Find(&packages).Error
	if err != nil {
		return nil, 0, err
	}
	
	return packages, total, nil
}

// SearchPackages 搜索包
func (s *Service) SearchPackages(ctx context.Context, query string, limit, offset int) ([]model.PyPIPackage, int64, error) {
	var packages []model.PyPIPackage
	var total int64
	
	query = "%" + query + "%"
	
	tx := s.db.WithContext(ctx).Model(&model.PyPIPackage{}).
		Where("name LIKE ? OR summary LIKE ?", query, query)
	tx.Count(&total)
	
	err := tx.Limit(limit).Offset(offset).Find(&packages).Error
	if err != nil {
		return nil, 0, err
	}
	
	return packages, total, nil
}
// UploadPackage 上传 Python 包（支持 wheel 和 sdist）
func (s *Service) UploadPackage(ctx context.Context, filename string, fileData []byte, uploaderID uint, uploader string) error {
	normalizedName := normalizePackageName(filename)
	
	// 解析文件名获取包信息
	dist, version, packagetype, err := parseFilename(filename)
	if err != nil {
		return fmt.Errorf("invalid filename: %w", err)
	}
	
	// 解析元数据
	var metadata *PKGInfo
	if packagetype == "bdist_wheel" {
		metadata, err = ParsePKGInfoFromWheel(fileData)
		if err != nil {
			// Wheel 解析失败时尝试从文件名推断
			metadata = &PKGInfo{
				Name:    dist,
				Version: version,
			}
		}
	} else {
		// Sdist 暂时跳过元数据解析
		metadata = &PKGInfo{
			Name:    dist,
			Version: version,
		}
	}
	
	// 计算哈希值
	md5Hash, _ := calculateMD5(bytes.NewReader(fileData))
	sha256Hash, _ := calculateSHA256(bytes.NewReader(fileData))
	
	// 保存文件到磁盘
	localPath := s.fileStoragePath(normalizedName, filename)
	if err := ensureDir(filepath.Dir(localPath)); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	
	tmpPath := localPath + ".tmp"
	if err := os.WriteFile(tmpPath, fileData, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}
	
	if err := os.Rename(tmpPath, localPath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to save file: %w", err)
	}
	
	// 保存到数据库
	return s.saveUploadedPackage(ctx, normalizedName, filename, version, packagetype, localPath,
		int64(len(fileData)), md5Hash, sha256Hash, metadata, uploaderID, uploader)
}

// saveUploadedPackage 保存上传的包信息到数据库
func (s *Service) saveUploadedPackage(ctx context.Context, normalizedName, filename, version, packagetype, localPath string,
	size int64, md5Hash, sha256Hash string, metadata *PKGInfo, uploaderID uint, uploader string) error {
	
	// 查找或创建 package
	var pkg model.PyPIPackage
	err := s.db.WithContext(ctx).Where("name = ?", normalizedName).First(&pkg).Error
	
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			pkg = model.PyPIPackage{
				Name:        normalizedName,
				Summary:     metadata.Summary,
				HomePage:    metadata.HomePage,
				License:     metadata.License,
				Author:      metadata.Author,
				AuthorEmail: metadata.AuthorEmail,
				IsUploaded:  true,
				UploaderID:  uploaderID,
				Uploader:    uploader,
			}
			if err := s.db.WithContext(ctx).Create(&pkg).Error; err != nil {
				return err
			}
		} else {
			return err
		}
	} else {
		// 更新已有包的元数据
		updates := map[string]interface{}{
			"summary":      metadata.Summary,
			"home_page":    metadata.HomePage,
			"license":      metadata.License,
			"author":       metadata.Author,
			"author_email": metadata.AuthorEmail,
		}
		s.db.WithContext(ctx).Model(&pkg).Updates(updates)
	}
	
	// 查找或创建 version
	var ver model.PyPIVersion
	err = s.db.WithContext(ctx).Where("package_id = ? AND version = ?", pkg.ID, version).First(&ver).Error
	
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ver = model.PyPIVersion{
				PackageID:      pkg.ID,
				Version:        version,
				RequiresPython: metadata.RequiresPython,
			}
			if err := s.db.WithContext(ctx).Create(&ver).Error; err != nil {
				return err
			}
		} else {
			return ErrVersionExists
		}
	}
	
	// 提取 python_version 和 platform 信息
	pythonVersion := ""
	platform := ""
	
	if packagetype == "bdist_wheel" {
		baseName := strings.TrimSuffix(filename, ".whl")
		parts := strings.Split(baseName, "-")
		if len(parts) >= 5 {
			pythonVersion = parts[2]
			platform = parts[4]
		}
	} else {
		pythonVersion = "source"
		platform = "any"
	}
	
	// 检查文件是否已存在
	var existingFile model.PyPIFile
	if err := s.db.WithContext(ctx).Where("version_id = ? AND filename = ?", ver.ID, filename).First(&existingFile).Error; err == nil {
		return fmt.Errorf("file %s already exists for version %s", filename, version)
	}
	
	// 创建 file 记录
	file := model.PyPIFile{
		VersionID:         ver.ID,
		Filename:          filename,
		Path:              localPath,
		Size:              size,
		MD5:               md5Hash,
		SHA256:            sha256Hash,
		Packagetype:       packagetype,
		PythonVersion:     pythonVersion,
		Platform:          platform,
		Cached:            true,
		IsUploaded:        true,
		UploadTimeFormatted: time.Now().Format(time.RFC3339),
	}
	
	return s.db.WithContext(ctx).Create(&file).Error
}

// DeletePackage 删除整个包及其所有版本
func (s *Service) DeletePackage(ctx context.Context, name string) error {
	normalizedName := normalizePackageName(name)
	
	var pkg model.PyPIPackage
	if err := s.db.WithContext(ctx).Where("name = ?", normalizedName).First(&pkg).Error; err != nil {
		return err
	}
	
	// 删除所有版本和文件
	var versions []model.PyPIVersion
	if err := s.db.WithContext(ctx).Where("package_id = ?", pkg.ID).Find(&versions).Error; err != nil {
		return err
	}
	
	for _, ver := range versions {
		if err := s.DeleteVersion(ctx, pkg.Name, ver.Version); err != nil {
			return err
		}
	}
	
	// 删除包记录
	return s.db.WithContext(ctx).Delete(&pkg).Error
}

// DeleteVersion 删除特定版本及其文件
func (s *Service) DeleteVersion(ctx context.Context, name, version string) error {
	normalizedName := normalizePackageName(name)
	
	var pkg model.PyPIPackage
	if err := s.db.WithContext(ctx).Where("name = ?", normalizedName).First(&pkg).Error; err != nil {
		return err
	}
	
	var ver model.PyPIVersion
	if err := s.db.WithContext(ctx).Where("package_id = ? AND version = ?", pkg.ID, version).First(&ver).Error; err != nil {
		return err
	}
	
	// 删除所有文件
	var files []model.PyPIFile
	if err := s.db.WithContext(ctx).Where("version_id = ?", ver.ID).Find(&files).Error; err != nil {
		return err
	}
	
	for _, file := range files {
		// 删除物理文件（仅删除上传的文件，不删除缓存的文件）
		if file.IsUploaded && file.Path != "" {
			os.Remove(file.Path)
			os.Remove(file.Path + ".md5")
			os.Remove(file.Path + ".sha256")
		}
	}
	
	// 删除文件记录
	if err := s.db.WithContext(ctx).Where("version_id = ?", ver.ID).Delete(&model.PyPIFile{}).Error; err != nil {
		return err
	}
	
	// 删除版本记录
	return s.db.WithContext(ctx).Delete(&ver).Error
}

// DeleteFile 删除特定文件
func (s *Service) DeleteFile(ctx context.Context, name, version, filename string) error {
	normalizedName := normalizePackageName(name)
	
	var pkg model.PyPIPackage
	if err := s.db.WithContext(ctx).Where("name = ?", normalizedName).First(&pkg).Error; err != nil {
		return err
	}
	
	var ver model.PyPIVersion
	if err := s.db.WithContext(ctx).Where("package_id = ? AND version = ?", pkg.ID, version).First(&ver).Error; err != nil {
		return err
	}
	
	var file model.PyPIFile
	if err := s.db.WithContext(ctx).Where("version_id = ? AND filename = ?", ver.ID, filename).First(&file).Error; err != nil {
		return err
	}
	
	// 删除物理文件（仅删除上传的文件）
	if file.IsUploaded && file.Path != "" {
		os.Remove(file.Path)
		os.Remove(file.Path + ".md5")
		os.Remove(file.Path + ".sha256")
	}
	
	// 删除文件记录
	return s.db.WithContext(ctx).Delete(&file).Error
}

// GetCacheStats 获取缓存统计信息
func (s *Service) GetCacheStats(ctx context.Context) (map[string]interface{}, error) {
	var totalPackages, totalVersions, totalFiles int64
	var totalSize int64
	
	s.db.WithContext(ctx).Model(&model.PyPIPackage{}).Count(&totalPackages)
	s.db.WithContext(ctx).Model(&model.PyPIVersion{}).Count(&totalVersions)
	s.db.WithContext(ctx).Model(&model.PyPIFile{}).Count(&totalFiles)
	
	// 计算总大小
	s.db.WithContext(ctx).Model(&model.PyPIFile{}).Select("SUM(size)").Scan(&totalSize)
	
	// 计算上传和缓存的数量
	var uploadedCount, cachedCount int64
	s.db.WithContext(ctx).Model(&model.PyPIFile{}).Where("is_uploaded = ?", true).Count(&uploadedCount)
	s.db.WithContext(ctx).Model(&model.PyPIFile{}).Where("is_uploaded = ?", false).Count(&cachedCount)
	
	return map[string]interface{}{
		"package_count":   totalPackages,
		"version_count":   totalVersions,
		"file_count":      totalFiles,
		"total_size":      totalSize,
		"uploaded_count":  uploadedCount,
		"cached_count":    cachedCount,
		"upstream":        s.upstream(),
	}, nil
}

// CleanCache 清理缓存（只删除缓存的文件，不删除上传的文件）
func (s *Service) CleanCache(ctx context.Context) (int64, error) {
	var cachedFiles []model.PyPIFile
	if err := s.db.WithContext(ctx).Where("is_uploaded = ? AND cached = ?", false, true).Find(&cachedFiles).Error; err != nil {
		return 0, err
	}
	
	deletedCount := int64(0)
	for _, file := range cachedFiles {
		// 删除物理文件
		if file.Path != "" {
			os.Remove(file.Path)
			os.Remove(file.Path + ".md5")
			os.Remove(file.Path + ".sha256")
		}
		
		// 删除数据库记录
		if err := s.db.WithContext(ctx).Delete(&file).Error; err != nil {
			continue
		}
		deletedCount++
	}
	
	return deletedCount, nil
}

// FetchPopularPackages 从上游获取热门包列表并保存到数据库
func (s *Service) FetchPopularPackages(ctx context.Context) error {
	// 从 PyPI simple API 获取所有包列表
	upstream := s.upstream()
	url := fmt.Sprintf("%s/simple/", upstream)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("upstream returned status %d", resp.StatusCode)
	}
	
	// 解析 HTML 获取包名
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	
	// 简单解析：提取 <a href="/simple/{name}/">{name}</a>
	// 由于包太多，这里只取前 100 个作为演示
	lines := strings.Split(string(body), "\n")
	count := 0
	maxPackages := 100
	
	for _, line := range lines {
		if count >= maxPackages {
			break
		}
		// 匹配 <a href="/simple/包名/">包名</a>
		idx := strings.Index(line, `<a href="/simple/`)
		if idx == -1 {
			continue
		}
		
		// 提取包名
		start := idx + len(`<a href="/simple/`)
		end := strings.Index(line[start:], "/")
		if end == -1 {
			continue
		}
		pkgName := line[start : start+end]
		pkgName = strings.TrimSpace(pkgName)
		
		if pkgName != "" && strings.ToLower(pkgName) == pkgName {
			// 保存到数据库（只保存基本信息，不获取版本）
			var existing model.PyPIPackage
			if err := s.db.WithContext(ctx).Where("name = ?", pkgName).First(&existing).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					pkg := model.PyPIPackage{
						Name:       pkgName,
						IsUploaded: false,
					}
					s.db.WithContext(ctx).Create(&pkg)
					count++
				}
			}
		}
	}
	
	return nil
}

// FetchAndSavePackageVersions 从上游获取特定包的所有版本并保存到数据库
func (s *Service) FetchAndSavePackageVersions(ctx context.Context, normalizedName string) error {
	upstream := s.upstream()
	url := fmt.Sprintf("%s/simple/%s/", upstream, normalizedName)
	
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == http.StatusNotFound {
		return ErrPackageNotFound
	}
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("upstream returned status %d", resp.StatusCode)
	}
	
	// 解析 HTML 获取版本文件链接
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	
	// 查找或创建 package 记录
	var pkg model.PyPIPackage
	if err := s.db.WithContext(ctx).Where("name = ?", normalizedName).First(&pkg).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			pkg = model.PyPIPackage{
				Name:       normalizedName,
				IsUploaded: false,
			}
			if err := s.db.WithContext(ctx).Create(&pkg).Error; err != nil {
				return err
			}
		} else {
			return err
		}
	}
	
	// 解析版本信息
	// 格式：<a href="https://files.pythonhosted.org/packages/.../xxx.tar.gz#sha256=...">xxx.tar.gz</a>
	lines := strings.Split(string(body), "\n")
	
	for _, line := range lines {
		// 查找文件链接
		idx := strings.Index(line, `<a href="`)
		if idx == -1 {
			continue
		}
		
		// 提取 href
		start := idx + len(`<a href="`)
		end := strings.Index(line[start:], `"`)
		if end == -1 {
			continue
		}
		href := line[start : start+end]
		
		// 跳过不以 https://files.pythonhosted.org/packages/ 开头的链接
		if !strings.HasPrefix(href, "https://files.pythonhosted.org/packages/") {
			continue
		}
		
		// 提取文件名 - 从 URL 中提取
		// 格式：https://files.pythonhosted.org/packages/.../filename#sha256=...
		filename := ""
		sha256 := ""
		
		// 查找 #sha256= 位置
		if hashIdx := strings.Index(href, "#sha256="); hashIdx != -1 {
			// 从 URL 路径部分提取文件名
			pathPart := href[:hashIdx]
			filename = filepath.Base(pathPart)
			sha256 = href[hashIdx+8:] // 跳过 "#sha256="
		} else {
			// 没有 hash，直接取文件名
			filename = filepath.Base(href)
		}
		
		if filename == "" || !strings.HasSuffix(filename, ".tar.gz") && !strings.HasSuffix(filename, ".whl") {
			continue
		}
		
		// 解析文件名获取版本
		_, version, pkgType, err := parseFilename(filename)
		if err != nil {
			continue
		}
		
		// 查找或创建 version
		var ver model.PyPIVersion
		if err := s.db.WithContext(ctx).Where("package_id = ? AND version = ?", pkg.ID, version).First(&ver).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				ver = model.PyPIVersion{
					PackageID: pkg.ID,
					Version:   version,
				}
				if err := s.db.WithContext(ctx).Create(&ver).Error; err != nil {
					continue
				}
			} else {
				continue
			}
		}
		
		// 提取 python version 和 platform
		pythonVersion := ""
		platform := ""
		
		if pkgType == "bdist_wheel" {
			baseName := strings.TrimSuffix(filename, ".whl")
			parts := strings.Split(baseName, "-")
			if len(parts) >= 5 {
				pythonVersion = parts[2]
				platform = parts[4]
			}
		} else {
			pythonVersion = "source"
			platform = "any"
		}
		
		// 创建文件记录
		file := model.PyPIFile{
			VersionID:     ver.ID,
			Filename:      filename,
			SHA256:        sha256,
			Packagetype:   pkgType,
			PythonVersion: pythonVersion,
			Platform:      platform,
			Cached:        false, // 标记为未缓存
			IsUploaded:    false,
		}
		
		// 检查是否已存在
		var existing model.PyPIFile
		if err := s.db.WithContext(ctx).Where("version_id = ? AND filename = ?", ver.ID, filename).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				s.db.WithContext(ctx).Create(&file)
			}
		}
	}

	return nil
}

// extractFileURL 从 Simple API HTML 响应中提取目标文件的 URL
func (s *Service) extractFileURL(htmlContent, targetFilename string) string {
	lines := strings.Split(htmlContent, "\n")

	for _, line := range lines {
		// 查找包含目标文件名的链接
		if !strings.Contains(line, targetFilename) {
			continue
		}

		// 提取 href
		idx := strings.Index(line, `<a href="`)
		if idx == -1 {
			continue
		}

		start := idx + len(`<a href="`)
		end := strings.Index(line[start:], `"`)
		if end == -1 {
			continue
		}

		href := line[start : start+end]

		// 只返回 files.pythonhosted.org 的链接
		if strings.HasPrefix(href, "https://files.pythonhosted.org/") {
			return href
		}
	}

	return ""
}
