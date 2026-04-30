package oci

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/model"
	"gorm.io/gorm"
)

// PushManifest 处理推送的 manifest
func (s *Service) PushManifest(ctx context.Context, name, reference, mediaType string, content []byte, userID uint, username string) (digest string, err error) {
	name = s.normalizeImageName(name)

	// 计算 digest
	h := sha256.New()
	h.Write(content)
	digest = "sha256:" + hex.EncodeToString(h.Sum(nil))

	// 解析 manifest 获取 layers
	var manifest struct {
		Layers []struct {
			Digest string `json:"digest"`
			Size   int64  `json:"size"`
		} `json:"layers"`
		Config struct {
			Digest string `json:"digest"`
			Size   int64  `json:"size"`
		} `json:"config"`
	}
	if err := json.Unmarshal(content, &manifest); err != nil {
		return "", fmt.Errorf("parse manifest: %w", err)
	}

	// 事务处理
	var staleBlobPaths []string
	err = s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 获取或创建仓库
		var repo model.OciRepository
		if err := tx.Where("name = ?", name).First(&repo).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				repo = model.OciRepository{
					Name:       name,
					Upstream:   "local", // 本地推送的镜像标记为 local
					IsPushed:   true,
					PushedByID: userID,
					PushedBy:   username,
				}
				if err := tx.Create(&repo).Error; err != nil {
					return fmt.Errorf("create repo: %w", err)
				}
			} else {
				return fmt.Errorf("get repo: %w", err)
			}
		} else {
			// 更新推送信息
			repo.IsPushed = true
			repo.PushedByID = userID
			repo.PushedBy = username
			repo.UpdatedAt = time.Now()
			if err := tx.Save(&repo).Error; err != nil {
				return fmt.Errorf("update repo: %w", err)
			}
		}

		var previousDigest string

		// 2. 保存 manifest
		var mf model.OciManifest
		if err := tx.Where("digest = ?", digest).First(&mf).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				mf = model.OciManifest{
					RepositoryID: repo.ID,
					Digest:       digest,
					MediaType:    mediaType,
					Content:      string(content),
					Size:         int64(len(content)),
				}
				if err := tx.Create(&mf).Error; err != nil {
					return fmt.Errorf("create manifest: %w", err)
				}
			} else {
				return fmt.Errorf("get manifest: %w", err)
			}
		}

		// 3. 保存或更新 tag
		if !strings.HasPrefix(reference, "sha256:") {
			var tag model.OciTag
			result := tx.Where("repository_id = ? AND tag = ?", repo.ID, reference).First(&tag)
			if result.Error != nil {
				if result.Error == gorm.ErrRecordNotFound {
					tag = model.OciTag{
						RepositoryID:   repo.ID,
						Tag:            reference,
						ManifestDigest: digest,
					}
					if err := tx.Create(&tag).Error; err != nil {
						return fmt.Errorf("create tag: %w", err)
					}
				} else {
					return fmt.Errorf("get tag: %w", result.Error)
				}
			} else {
				previousDigest = tag.ManifestDigest
				tag.ManifestDigest = digest
				if err := tx.Save(&tag).Error; err != nil {
					return fmt.Errorf("update tag: %w", err)
				}
			}
		}

		// 4. 记录 blobs（如果还没有记录）
		allBlobs := append(manifest.Layers, struct {
			Digest string `json:"digest"`
			Size   int64  `json:"size"`
		}{Digest: manifest.Config.Digest, Size: manifest.Config.Size})

		for _, layer := range allBlobs {
			var blob model.OciBlob
			result := tx.Where("digest = ?", layer.Digest).First(&blob)
			if result.Error != nil {
				if result.Error == gorm.ErrRecordNotFound {
					blob = model.OciBlob{
						RepositoryID: repo.ID,
						Digest:       layer.Digest,
						Size:         layer.Size,
						Cached:       false, // 初始状态为未缓存，等待 blob 上传
					}
					if err := tx.Create(&blob).Error; err != nil {
						return fmt.Errorf("create blob record: %w", err)
					}
				}
			}
			// 关联 manifest 与 blob，维护引用计数
			// 需要确保 mf.ID 已经存在
			if mf.ID != 0 {
				// 查找是否已经存在关联
				var exists model.OciManifestBlob
				if err := tx.Where("manifest_id = ? AND blob_id = ?", mf.ID, blob.ID).First(&exists).Error; err != nil {
					if err == gorm.ErrRecordNotFound {
						if err := tx.Create(&model.OciManifestBlob{
							ManifestID: mf.ID,
							BlobID:     blob.ID,
						}).Error; err != nil {
							return fmt.Errorf("create manifest-blob link: %w", err)
						}
					} else {
						return fmt.Errorf("check manifest-blob link: %w", err)
					}
				}
				// 只有首次建立关联时才增加引用计数
				if blob.ID != 0 && exists.ID == 0 {
					if err := tx.Model(&blob).UpdateColumn("ref_count", gorm.Expr("ref_count + ?", 1)).Error; err != nil {
						return fmt.Errorf("increment blob ref_count: %w", err)
					}
				}
			}
		}

		if previousDigest != "" && previousDigest != digest {
			paths, err := s.releaseManifestIfUnreferenced(tx, repo.ID, previousDigest, "tag_replaced")
			if err != nil {
				return fmt.Errorf("release previous manifest: %w", err)
			}
			staleBlobPaths = append(staleBlobPaths, paths...)
		}

		return nil
	})

	if err != nil {
		return "", err
	}

	// 删除已释放的 blob 文件（事务提交后）
	s.removeStaleBlobs(staleBlobPaths)

	return digest, nil
}

func (s *Service) deleteManifestRecord(tx *gorm.DB, manifest model.OciManifest, reason string) ([]string, error) {
	var links []model.OciManifestBlob
	if err := tx.Where("manifest_id = ?", manifest.ID).Find(&links).Error; err != nil {
		return nil, err
	}

	var blobIDs []uint
	for _, l := range links {
		blobIDs = append(blobIDs, l.BlobID)
		if err := tx.Model(&model.OciBlob{}).
			Where("id = ? AND ref_count > 0", l.BlobID).
			UpdateColumn("ref_count", gorm.Expr("ref_count - ?", 1)).Error; err != nil {
			return nil, err
		}
	}

	var staleBlobPaths []string
	if len(blobIDs) > 0 {
		if err := tx.Where("manifest_id = ?", manifest.ID).Delete(&model.OciManifestBlob{}).Error; err != nil {
			return nil, err
		}

		var blobs []model.OciBlob
		if err := tx.Where("id IN ?", blobIDs).Find(&blobs).Error; err != nil {
			return nil, err
		}

		var unreferencedIDs []uint
		for _, b := range blobs {
			if b.RefCount <= 0 {
				unreferencedIDs = append(unreferencedIDs, b.ID)
				staleBlobPaths = append(staleBlobPaths, s.blobPath(b.Digest))
			}
		}
		if len(unreferencedIDs) > 0 {
			if err := tx.Where("id IN ?", unreferencedIDs).Delete(&model.OciBlob{}).Error; err != nil {
				return nil, err
			}
		}
	}

	return staleBlobPaths, tx.Delete(&manifest).Error
}

func (s *Service) releaseManifestIfUnreferenced(tx *gorm.DB, repoID uint, manifestDigest, reason string) ([]string, error) {
	var count int64
	if err := tx.Model(&model.OciTag{}).
		Where("repository_id = ? AND manifest_digest = ?", repoID, manifestDigest).
		Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, nil
	}

	var manifest model.OciManifest
	if err := tx.Where("repository_id = ? AND digest = ?", repoID, manifestDigest).First(&manifest).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	return s.deleteManifestRecord(tx, manifest, reason)
}

// PushBlob 处理推送的 blob
func (s *Service) PushBlob(ctx context.Context, digest string, r io.Reader) error {
	// 确保 digest 格式正确（带 sha256: 前缀）
	digest = strings.TrimPrefix(digest, "sha256:")
	digest = "sha256:" + digest

	// 获取 blob 路径（使用 blobPath 方法确保一致性）
	blobPath := s.blobPath(digest)

	// 确保目录存在
	blobDir := s.blobDir()
	if err := os.MkdirAll(blobDir, 0755); err != nil {
		return fmt.Errorf("create blob dir: %w", err)
	}

	// 检查 blob 是否已存在
	if _, err := os.Stat(blobPath); err == nil {
		// 已存在，直接返回成功
		return nil
	}

	// 创建临时文件
	tmpPath := blobPath + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	defer os.Remove(tmpPath)

	// 计算 digest 并写入文件
	h := sha256.New()
	w := io.MultiWriter(f, h)

	size, err := io.Copy(w, r)
	if err != nil {
		f.Close()
		return fmt.Errorf("write blob: %w", err)
	}
	f.Close()

	// 验证 digest
	computedDigest := "sha256:" + hex.EncodeToString(h.Sum(nil))
	if computedDigest != digest {
		os.Remove(tmpPath)
		return fmt.Errorf("digest mismatch: expected %s, got %s", digest, computedDigest)
	}

	// 移动到最终位置
	if err := os.Rename(tmpPath, blobPath); err != nil {
		return fmt.Errorf("rename blob: %w", err)
	}

	// 更新数据库中的 blob 状态
	s.db.Model(&model.OciBlob{}).Where("digest = ?", digest).Update("cached", true)

	log.Printf("[oci] blob saved: %s (%d bytes)", digest, size)
	return nil
}

// InitiateUpload 初始化 blob 上传，返回 upload URL
func (s *Service) InitiateUpload(ctx context.Context, name string) (uploadURL string, err error) {
	name = s.normalizeImageName(name)
	// 生成一个临时的 upload ID
	uploadID := generateUploadID()
	return fmt.Sprintf("/v2/%s/blobs/uploads/%s", name, uploadID), nil
}

func generateUploadID() string {
	b := make([]byte, 16)
	for i := range b {
		b[i] = byte(time.Now().UnixNano() % 256)
	}
	return hex.EncodeToString(b)
}

// CheckBlobExists 检查 blob 是否已存在
func (s *Service) CheckBlobExists(digest string) bool {
	digest = strings.TrimPrefix(digest, "sha256:")
	digest = "sha256:" + digest

	blobPath := filepath.Join(s.blobDir(), digest)
	_, err := os.Stat(blobPath)
	return err == nil
}

// DeleteManifest 删除 manifest
func (s *Service) DeleteManifest(ctx context.Context, name, reference string, userID uint) error {
	name = s.normalizeImageName(name)

	var staleBlobPaths []string
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 获取仓库信息
		var repo model.OciRepository
		if err := tx.Where("name = ?", name).First(&repo).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return ErrManifestNotFound
			}
			return err
		}

		// 检查权限（只有管理员或推送者可以删除）
		var user model.User
		if err := tx.First(&user, userID).Error; err != nil {
			return err
		}
		if !user.IsAdmin && repo.PushedByID != userID {
			return ErrForbidden
		}

		var manifestDigest string
		if isDigest(reference) {
			manifestDigest = reference
			result := tx.Where("repository_id = ? AND manifest_digest = ?", repo.ID, manifestDigest).Delete(&model.OciTag{})
			if result.Error != nil {
				return result.Error
			}

			var manifest model.OciManifest
			if err := tx.Where("repository_id = ? AND digest = ?", repo.ID, manifestDigest).First(&manifest).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return ErrManifestNotFound
				}
				return err
			}
		} else {
			var t model.OciTag
			if err := tx.Where("repository_id = ? AND tag = ?", repo.ID, reference).First(&t).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return ErrManifestNotFound
				}
				return err
			}
			manifestDigest = t.ManifestDigest

			if err := tx.Where("repository_id = ? AND tag = ?", repo.ID, reference).Delete(&model.OciTag{}).Error; err != nil {
				return err
			}
		}

		paths, err := s.releaseManifestIfUnreferenced(tx, repo.ID, manifestDigest, "manifest_deleted")
		if err != nil {
			return err
		}
		staleBlobPaths = append(staleBlobPaths, paths...)

		var remainingTags int64
		if err := tx.Model(&model.OciTag{}).Where("repository_id = ?", repo.ID).Count(&remainingTags).Error; err != nil {
			return err
		}
		if remainingTags == 0 {
			var remainingManifests int64
			if err := tx.Model(&model.OciManifest{}).Where("repository_id = ?", repo.ID).Count(&remainingManifests).Error; err != nil {
				return err
			}
			if remainingManifests == 0 {
				if err := tx.Delete(&repo).Error; err != nil {
					return err
				}
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

// removeStaleBlobs 删除磁盘上已释放的 blob 文件
func (s *Service) removeStaleBlobs(paths []string) {
	for _, p := range paths {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			log.Printf("[oci] failed to remove stale blob %s: %v", p, err)
		}
	}
}

var ErrForbidden = errors.New("forbidden")
