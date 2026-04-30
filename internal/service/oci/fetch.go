package oci

import (
	"context"
	"errors"
	"io"
	"os"

	"gorm.io/gorm"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/model"
)

// RepoInfo 管理 API 返回的仓库信息
type RepoInfo struct {
	ID              uint   `json:"id"`
	Name            string `json:"name"`
	Upstream        string `json:"upstream"`
	TagCount        int64  `json:"tag_count"`
	CachedBlobCount int64  `json:"cached_blob_count"`
	TotalSize       int64  `json:"total_size"`
	UpdatedAt       string `json:"updated_at"`
	IsPushed        bool   `json:"is_pushed"`
	PushedBy        string `json:"pushed_by"`
	PushedByID      uint   `json:"pushed_by_id"`
}

// TagInfo 管理 API 返回的 tag 信息
type TagInfo struct {
	Tag            string `json:"tag"`
	ManifestDigest string `json:"manifest_digest"`
	MediaType      string `json:"media_type"`
	Size           int64  `json:"size"`
	CreatedAt      string `json:"created_at"`
}

// CacheStats 缓存统计
type CacheStats struct {
	RepoCount int64 `json:"repo_count"`
	TagCount  int64 `json:"tag_count"`
	BlobCount int64 `json:"blob_count"`
	SizeBytes int64 `json:"size_bytes"`
}

// ── 本地查询方法 ──────────────────────────────────────────────────────────────

// GetManifest 从本地 DB 获取 manifest
func (s *Service) GetManifest(ctx context.Context, name, reference string) (content []byte, mediaType string, digest string, err error) {
	name = s.normalizeImageName(name)

	var manifest model.OciManifest

	if isDigest(reference) {
		// 按 digest 查找
		err = s.db.WithContext(ctx).Where("digest = ?", reference).First(&manifest).Error
	} else {
		// 按 tag 查找
		var tag model.OciTag
		err = s.db.WithContext(ctx).
			Joins("JOIN oci_repositories ON oci_repositories.id = oci_tags.repository_id").
			Where("oci_repositories.name = ? AND oci_tags.tag = ?", name, reference).
			First(&tag).Error
		if err == nil {
			err = s.db.WithContext(ctx).Where("digest = ?", tag.ManifestDigest).First(&manifest).Error
		}
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, "", "", ErrManifestNotFound
	}
	if err != nil {
		return nil, "", "", err
	}

	return []byte(manifest.Content), manifest.MediaType, manifest.Digest, nil
}

// GetBlob 从本地磁盘获取 blob
func (s *Service) GetBlob(ctx context.Context, name, digest string) (io.ReadCloser, int64, error) {
	diskPath := s.blobPath(digest)
	f, err := os.Open(diskPath)
	if err != nil {
		return nil, 0, ErrBlobNotFound
	}
	fi, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, 0, ErrBlobNotFound
	}
	return f, fi.Size(), nil
}

// BlobExists 检查 blob 是否已缓存
func (s *Service) BlobExists(ctx context.Context, digest string) (int64, bool) {
	diskPath := s.blobPath(digest)
	fi, err := os.Stat(diskPath)
	if err != nil {
		return 0, false
	}
	return fi.Size(), true
}

// ManifestExists 检查 manifest 是否存在
func (s *Service) ManifestExists(ctx context.Context, name, reference string) (int64, string, string, bool) {
	content, mediaType, digest, err := s.GetManifest(ctx, name, reference)
	if err != nil {
		return 0, "", "", false
	}
	return int64(len(content)), mediaType, digest, true
}

// IsLocalRepository 检查仓库是否是本地推送的（不是代理的）
// 返回 (exists, isLocal)，exists 表示仓库是否存在，isLocal 表示是否是本地推送的
func (s *Service) IsLocalRepository(ctx context.Context, name string) (exists bool, isLocal bool) {
	name = s.normalizeImageName(name)

	var repo model.OciRepository
	err := s.db.WithContext(ctx).Where("name = ?", name).First(&repo).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, false
		}
		// 查询出错，保守起见认为是本地仓库（不代理）
		return true, true
	}
	return true, repo.IsPushed
}

// ListCatalog 返回所有仓库名
func (s *Service) ListCatalog(ctx context.Context) ([]string, error) {
	var names []string
	err := s.db.WithContext(ctx).Model(&model.OciRepository{}).Pluck("name", &names).Error
	return names, err
}

// ListTags 返回某仓库的所有 tag
func (s *Service) ListTags(ctx context.Context, name string) ([]string, error) {
	name = s.normalizeImageName(name)

	var tags []string
	err := s.db.WithContext(ctx).
		Model(&model.OciTag{}).
		Joins("JOIN oci_repositories ON oci_repositories.id = oci_tags.repository_id").
		Where("oci_repositories.name = ?", name).
		Pluck("oci_tags.tag", &tags).Error
	return tags, err
}

// ── 管理 API 方法 ──────────────────────────────────────────────────────────────

// ListRepositories 列出仓库（分页+搜索）
func (s *Service) ListRepositories(ctx context.Context, page, pageSize int, search string) ([]RepoInfo, int64, error) {
	var total int64
	q := s.db.WithContext(ctx).Model(&model.OciRepository{})
	if search != "" {
		q = q.Where("name LIKE ?", "%"+search+"%")
	}
	q.Count(&total)

	var repos []model.OciRepository
	if err := q.Order("updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&repos).Error; err != nil {
		return nil, 0, err
	}

	result := make([]RepoInfo, 0, len(repos))
	for _, r := range repos {
		var tagCount int64
		s.db.WithContext(ctx).Model(&model.OciTag{}).Where("repository_id = ?", r.ID).Count(&tagCount)
		var cachedCount int64
		s.db.WithContext(ctx).Model(&model.OciBlob{}).Where("repository_id = ? AND cached = ?", r.ID, true).Count(&cachedCount)
		var totalSize int64
		s.db.WithContext(ctx).Model(&model.OciBlob{}).Where("repository_id = ? AND deleted_at IS NULL", r.ID).Select("COALESCE(SUM(size),0)").Scan(&totalSize)

		result = append(result, RepoInfo{
			ID:              r.ID,
			Name:            r.Name,
			Upstream:        r.Upstream,
			TagCount:        tagCount,
			CachedBlobCount: cachedCount,
			TotalSize:       totalSize,
			UpdatedAt:       r.UpdatedAt.Format("2006-01-02T15:04:05Z"),
			IsPushed:        r.IsPushed,
			PushedBy:        r.PushedBy,
			PushedByID:      r.PushedByID,
		})
	}

	return result, total, nil
}

// ListTagsForRepo 列出某仓库的 tag 详情
func (s *Service) ListTagsForRepo(ctx context.Context, name string) ([]TagInfo, error) {
	var tags []model.OciTag
	err := s.db.WithContext(ctx).
		Joins("JOIN oci_repositories ON oci_repositories.id = oci_tags.repository_id").
		Where("oci_repositories.name = ?", name).
		Order("oci_tags.updated_at DESC").
		Find(&tags).Error
	if err != nil {
		return nil, err
	}

	result := make([]TagInfo, 0, len(tags))
	for _, t := range tags {
		var manifest model.OciManifest
		mediaType := ""
		var size int64
		if err := s.db.WithContext(ctx).Where("digest = ?", t.ManifestDigest).First(&manifest).Error; err == nil {
			mediaType = manifest.MediaType
			size = manifest.Size
		}
		result = append(result, TagInfo{
			Tag:            t.Tag,
			ManifestDigest: t.ManifestDigest,
			MediaType:      mediaType,
			Size:           size,
			CreatedAt:      t.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}
	return result, nil
}

// DeleteRepository 删除仓库及其所有关联数据
// 使用引用计数机制，只删除未被其他仓库引用的 blob
func (s *Service) DeleteRepository(ctx context.Context, id uint) error {
	var repo model.OciRepository
	if err := s.db.WithContext(ctx).First(&repo, id).Error; err != nil {
		return ErrRepoNotFound
	}

	var staleBlobPaths []string
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 获取该仓库的所有 manifest
		var manifests []model.OciManifest
		if err := tx.Where("repository_id = ?", id).Find(&manifests).Error; err != nil {
			return err
		}

		// 2. 获取该仓库的所有 blob（用于后续可能的删除）
		var blobs []model.OciBlob
		if err := tx.Where("repository_id = ?", id).Find(&blobs).Error; err != nil {
			return err
		}

		// 3. 对每个 manifest，递减其 blob 的引用计数
		for _, m := range manifests {
			var links []model.OciManifestBlob
			if err := tx.Where("manifest_id = ?", m.ID).Find(&links).Error; err != nil {
				return err
			}
			for _, l := range links {
				if err := tx.Model(&model.OciBlob{}).Where("id = ?", l.BlobID).
					UpdateColumn("ref_count", gorm.Expr("ref_count - ?", 1)).Error; err != nil {
					return err
				}
			}
			// 删除 manifest-blob 关联
			if err := tx.Where("manifest_id = ?", m.ID).Delete(&model.OciManifestBlob{}).Error; err != nil {
				return err
			}
		}

		// 4. 删除 DB 记录
		if err := tx.Where("repository_id = ?", id).Delete(&model.OciTag{}).Error; err != nil {
			return err
		}
		if err := tx.Where("repository_id = ?", id).Delete(&model.OciManifest{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&repo).Error; err != nil {
			return err
		}

		// 5. 删除 ref_count <= 0 的 blob
		var unreferencedIDs []uint
		for _, b := range blobs {
			var currentBlob model.OciBlob
			if err := tx.Where("id = ?", b.ID).First(&currentBlob).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					continue
				}
				return err
			}
			if currentBlob.RefCount <= 0 {
				unreferencedIDs = append(unreferencedIDs, b.ID)
				staleBlobPaths = append(staleBlobPaths, s.blobPath(b.Digest))
			}
		}
		if len(unreferencedIDs) > 0 {
			if err := tx.Where("id IN ?", unreferencedIDs).Delete(&model.OciBlob{}).Error; err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return err
	}

	// 删除已释放的 blob 文件（事务提交后）
	s.removeStaleBlobs(staleBlobPaths)
	return nil
}

// GetStats 获取缓存统计
func (s *Service) GetStats(ctx context.Context) (*CacheStats, error) {
	stats := &CacheStats{}
	s.db.WithContext(ctx).Model(&model.OciRepository{}).Count(&stats.RepoCount)
	s.db.WithContext(ctx).Model(&model.OciTag{}).Count(&stats.TagCount)
	s.db.WithContext(ctx).Model(&model.OciBlob{}).Where("cached = ? AND deleted_at IS NULL", true).Count(&stats.BlobCount)
	s.db.WithContext(ctx).Model(&model.OciBlob{}).Where("deleted_at IS NULL").Select("COALESCE(SUM(size),0)").Scan(&stats.SizeBytes)
	return stats, nil
}

// CleanCache 清理所有 OCI 缓存
func (s *Service) CleanCache(ctx context.Context) error {
	// 删除磁盘文件
	os.RemoveAll(s.blobDir())

	// 清空 DB 表
	s.db.WithContext(ctx).Where("1 = 1").Delete(&model.OciBlob{})
	s.db.WithContext(ctx).Where("1 = 1").Delete(&model.OciManifest{})
	s.db.WithContext(ctx).Where("1 = 1").Delete(&model.OciTag{})
	s.db.WithContext(ctx).Where("1 = 1").Delete(&model.OciRepository{})
	return nil
}

// ── 辅助方法 ──────────────────────────────────────────────────────────────────

// isDigest 判断 reference 是否为 digest 格式
func isDigest(ref string) bool {
	return len(ref) > 7 && ref[:7] == "sha256:"
}
