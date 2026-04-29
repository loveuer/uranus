package oci

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/model"
	"gitea.loveuer.com/loveuer/uranus/v2/internal/service"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// setupTestDB 创建测试用的内存数据库
func setupTestDB(t *testing.T) *gorm.DB {
	// 使用随机名称创建独立的数据库
	dbName := fmt.Sprintf("file:memdb%d?mode=memory&cache=private", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dbName), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// 自动迁移表结构
	err = db.AutoMigrate(
		&model.OciRepository{},
		&model.OciTag{},
		&model.OciManifest{},
		&model.OciBlob{},
		&model.OciManifestBlob{},
		&model.GcCandidate{},
		&model.GcStatus{},
		&model.User{},
		&model.Setting{},
	)
	if err != nil {
		t.Fatalf("failed to migrate tables: %v", err)
	}

	return db
}

// setupTestSettingService 创建测试用的 SettingService
func setupTestSettingService(db *gorm.DB) *service.SettingService {
	return service.NewSettingService(db)
}

// setupTestData 创建测试数据：一个仓库包含一个 manifest，manifest 引用多个 blob
func setupTestData(t *testing.T, db *gorm.DB) (repoID uint, manifestID uint, blobIDs []uint) {
	ctx := context.Background()

	// 创建仓库
	repo := model.OciRepository{
		Name:     "test/repo",
		Upstream: "local",
		IsPushed: true,
	}
	if err := db.WithContext(ctx).Create(&repo).Error; err != nil {
		t.Fatalf("failed to create repo: %v", err)
	}
	repoID = repo.ID

	// 创建 blob（模拟镜像的 layers 和 config，pushed blob 的 Cached=false）
	blobs := []model.OciBlob{
		{RepositoryID: repoID, Digest: "sha256:blob1abc123", Size: 1024, RefCount: 0, Cached: false},
		{RepositoryID: repoID, Digest: "sha256:blob2def456", Size: 2048, RefCount: 0, Cached: false},
		{RepositoryID: repoID, Digest: "sha256:config789", Size: 512, RefCount: 0, Cached: false},
	}
	for i := range blobs {
		if err := db.WithContext(ctx).Create(&blobs[i]).Error; err != nil {
			t.Fatalf("failed to create blob: %v", err)
		}
		blobIDs = append(blobIDs, blobs[i].ID)
	}

	// 创建 manifest
	manifest := model.OciManifest{
		RepositoryID: repoID,
		Digest:       "sha256:manifest123",
		MediaType:    "application/vnd.docker.distribution.manifest.v2+json",
		Content:      "{}",
		Size:         100,
	}
	if err := db.WithContext(ctx).Create(&manifest).Error; err != nil {
		t.Fatalf("failed to create manifest: %v", err)
	}
	manifestID = manifest.ID

	// 创建 manifest-blob 关联，并增加 blob 引用计数
	for _, blobID := range blobIDs {
		link := model.OciManifestBlob{
			ManifestID: manifestID,
			BlobID:     blobID,
		}
		if err := db.WithContext(ctx).Create(&link).Error; err != nil {
			t.Fatalf("failed to create manifest-blob link: %v", err)
		}
		// 增加 blob 引用计数
		if err := db.WithContext(ctx).Model(&model.OciBlob{}).Where("id = ?", blobID).
			UpdateColumn("ref_count", gorm.Expr("ref_count + ?", 1)).Error; err != nil {
			t.Fatalf("failed to increment blob ref_count: %v", err)
		}
	}

	// 创建 tag
	tag := model.OciTag{
		RepositoryID:   repoID,
		Tag:            "latest",
		ManifestDigest: manifest.Digest,
	}
	if err := db.WithContext(ctx).Create(&tag).Error; err != nil {
		t.Fatalf("failed to create tag: %v", err)
	}

	return repoID, manifestID, blobIDs
}

// verifyBlobRefCounts 验证 blob 引用计数
func verifyBlobRefCounts(t *testing.T, db *gorm.DB, blobIDs []uint, expectedCounts []int64) {
	for i, blobID := range blobIDs {
		var blob model.OciBlob
		if err := db.First(&blob, blobID).Error; err != nil {
			t.Fatalf("failed to get blob %d: %v", blobID, err)
		}
		if blob.RefCount != expectedCounts[i] {
			t.Errorf("blob %d ref_count expected %d, got %d", blobID, expectedCounts[i], blob.RefCount)
		}
	}
}

// TestDeleteManifest_RefCountDecrement 测试场景 A: 删除 tag 后的 manifest 和 blob 引用计数
func TestDeleteManifest_RefCountDecrement(t *testing.T) {
	db := setupTestDB(t)
	repoID, manifestID, blobIDs := setupTestData(t, db)

	// 创建临时目录用于存储 blob 文件
	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")
	os.MkdirAll(filepath.Join(dataDir, "blobs", "sha256"), 0755)

	// 创建 blob 文件
	for _, digest := range []string{"blob1abc123", "blob2def456", "config789"} {
		path := filepath.Join(dataDir, "blobs", "sha256", digest)
		os.WriteFile(path, []byte("test data"), 0644)
	}

	// 创建 service
	settingSvc := setupTestSettingService(db)
	svc := NewWithOptions(db, dataDir, settingSvc, GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    24 * time.Hour,
		EnableAutoGC:       false,
		MinUnreferencedAge: 0, // 测试时无最小时间要求
	})

	ctx := context.Background()

	// 1. 验证初始状态：所有 blob 的 ref_count = 1
	t.Run("initial state", func(t *testing.T) {
		verifyBlobRefCounts(t, db, blobIDs, []int64{1, 1, 1})
	})

	// 2. 创建管理员用户用于权限验证
	adminUser := model.User{
		Username: "admin",
		IsAdmin:  true,
	}
	if err := db.Create(&adminUser).Error; err != nil {
		t.Fatalf("failed to create admin user: %v", err)
	}

	// 3. 删除 manifest（通过删除 tag）
	t.Run("delete manifest via tag", func(t *testing.T) {
		err := svc.DeleteManifest(ctx, "test/repo", "latest", adminUser.ID)
		if err != nil {
			t.Fatalf("failed to delete manifest: %v", err)
		}

		// 验证 tag 已删除
		var count int64
		db.Model(&model.OciTag{}).Where("repository_id = ?", repoID).Count(&count)
		if count != 0 {
			t.Errorf("expected 0 tags, got %d", count)
		}

		// 验证 manifest 已删除
		var manifest model.OciManifest
		err = db.First(&manifest, manifestID).Error
		if err == nil {
			t.Error("expected manifest to be deleted, but it still exists")
		}

		// 验证 manifest-blob 关联已删除
		var linkCount int64
		db.Model(&model.OciManifestBlob{}).Where("manifest_id = ?", manifestID).Count(&linkCount)
		if linkCount != 0 {
			t.Errorf("expected 0 manifest-blob links, got %d", linkCount)
		}

		// 验证 blob 引用计数已递减为 0
		verifyBlobRefCounts(t, db, blobIDs, []int64{0, 0, 0})

		// 验证 blob 已被标记进入 GC
		for _, blobID := range blobIDs {
			var blob model.OciBlob
			if err := db.First(&blob, blobID).Error; err != nil {
				t.Fatalf("failed to get blob %d: %v", blobID, err)
			}
			if blob.DeletedAt == nil {
				t.Errorf("blob %d should have deleted_at set", blobID)
			}
		}

		var candidateCount int64
		db.Model(&model.GcCandidate{}).Count(&candidateCount)
		if candidateCount != 3 {
			t.Errorf("expected 3 gc candidates, got %d", candidateCount)
		}
	})
}

// TestDeleteRepository_RefCountAndGCCandidate 测试场景 C: 仓库删除后的层 GC
func TestDeleteRepository_RefCountAndGCCandidate(t *testing.T) {
	db := setupTestDB(t)
	repoID, _, blobIDs := setupTestData(t, db)

	// 创建临时目录
	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")
	os.MkdirAll(filepath.Join(dataDir, "blobs", "sha256"), 0755)

	// 创建 blob 文件
	for _, digest := range []string{"blob1abc123", "blob2def456", "config789"} {
		path := filepath.Join(dataDir, "blobs", "sha256", digest)
		os.WriteFile(path, []byte("test data"), 0644)
	}

	svc := NewWithOptions(db, dataDir, setupTestSettingService(db), GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    24 * time.Hour,
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	ctx := context.Background()

	t.Run("delete repository", func(t *testing.T) {
		// 验证初始状态
		verifyBlobRefCounts(t, db, blobIDs, []int64{1, 1, 1})

		// 删除仓库
		err := svc.DeleteRepository(ctx, repoID)
		if err != nil {
			t.Fatalf("failed to delete repository: %v", err)
		}

		// 验证仓库已删除
		var repo model.OciRepository
		err = db.First(&repo, repoID).Error
		if err == nil {
			t.Error("expected repository to be deleted, but it still exists")
		}

		// 验证 blob 引用计数已递减为 0
		verifyBlobRefCounts(t, db, blobIDs, []int64{0, 0, 0})

		// 验证 blob 被标记为软删除（deleted_at 不为空）
		for _, blobID := range blobIDs {
			var blob model.OciBlob
			if err := db.First(&blob, blobID).Error; err != nil {
				t.Fatalf("failed to get blob %d: %v", blobID, err)
			}
			if blob.DeletedAt == nil {
				t.Errorf("blob %d should have deleted_at set", blobID)
			}
		}

		// 验证 GC 候选记录已创建
		var candidates []model.GcCandidate
		if err := db.Find(&candidates).Error; err != nil {
			t.Fatalf("failed to get gc candidates: %v", err)
		}
		if len(candidates) != 3 {
			t.Errorf("expected 3 gc candidates, got %d", len(candidates))
		}

		// 验证候选记录包含正确的信息
		for _, c := range candidates {
			if c.Reason != "repository_deleted" {
				t.Errorf("expected reason 'repository_deleted', got '%s'", c.Reason)
			}
			if c.RepositoryID != repoID {
				t.Errorf("expected repository_id %d, got %d", repoID, c.RepositoryID)
			}
		}
	})
}

// TestGC_MarkPhase 测试 GC MarkPhase 正确识别未引用 blob
func TestGC_MarkPhase(t *testing.T) {
	db := setupTestDB(t)
	_, manifestID, blobIDs := setupTestData(t, db)

	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")

	gcSvc := NewGCServiceWithOptions(db, dataDir, GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    24 * time.Hour,
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	// ctx not used in this test
	_ = context.Background()

	t.Run("mark phase with all blobs referenced", func(t *testing.T) {
		err := db.Transaction(func(tx *gorm.DB) error {
			marks, err := gcSvc.MarkPhase(tx)
			if err != nil {
				return err
			}

			// 所有 blob 都应该被标记（被 manifest 引用）
			for _, blobID := range blobIDs {
				if !marks[blobID] {
					t.Errorf("blob %d should be marked as referenced", blobID)
				}
			}

			return nil
		})
		if err != nil {
			t.Fatalf("mark phase failed: %v", err)
		}
	})

	// 删除 manifest-blob 关联，使 blob 变为未引用
	t.Run("mark phase after unlinking", func(t *testing.T) {
		// 删除关联
		if err := db.Where("manifest_id = ?", manifestID).Delete(&model.OciManifestBlob{}).Error; err != nil {
			t.Fatalf("failed to delete manifest-blob links: %v", err)
		}

		// 将 blob ref_count 设为 0
		for _, blobID := range blobIDs {
			if err := db.Model(&model.OciBlob{}).Where("id = ?", blobID).Update("ref_count", 0).Error; err != nil {
				t.Fatalf("failed to update blob ref_count: %v", err)
			}
		}

		err := db.Transaction(func(tx *gorm.DB) error {
			marks, err := gcSvc.MarkPhase(tx)
			if err != nil {
				return err
			}

			// 所有 blob 都不应该被标记（未被引用）
			for _, blobID := range blobIDs {
				if marks[blobID] {
					t.Errorf("blob %d should not be marked as referenced", blobID)
				}
			}

			return nil
		})
		if err != nil {
			t.Fatalf("mark phase failed: %v", err)
		}
	})
}

// TestGC_FindUnreferencedBlobs 测试 FindUnreferencedBlobs 功能
func TestGC_FindUnreferencedBlobs(t *testing.T) {
	db := setupTestDB(t)
	_, manifestID, blobIDs := setupTestData(t, db)

	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")

	gcSvc := NewGCServiceWithOptions(db, dataDir, GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    24 * time.Hour,
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	t.Run("find unreferenced blobs", func(t *testing.T) {
		// 删除关联和 ref_count
		if err := db.Where("manifest_id = ?", manifestID).Delete(&model.OciManifestBlob{}).Error; err != nil {
			t.Fatalf("failed to delete manifest-blob links: %v", err)
		}
		for _, blobID := range blobIDs {
			if err := db.Model(&model.OciBlob{}).Where("id = ?", blobID).Update("ref_count", 0).Error; err != nil {
				t.Fatalf("failed to update blob ref_count: %v", err)
			}
		}

		var unreferenced []model.OciBlob
		err := db.Transaction(func(tx *gorm.DB) error {
			blobs, err := gcSvc.FindUnreferencedBlobs(tx)
			if err != nil {
				return err
			}
			unreferenced = blobs
			return nil
		})
		if err != nil {
			t.Fatalf("find unreferenced blobs failed: %v", err)
		}

		if len(unreferenced) != 3 {
			t.Errorf("expected 3 unreferenced blobs, got %d", len(unreferenced))
		}

		// 验证返回的 blob ID
		foundIDs := make(map[uint]bool)
		for _, b := range unreferenced {
			foundIDs[b.ID] = true
		}
		for _, blobID := range blobIDs {
			if !foundIDs[blobID] {
				t.Errorf("blob %d should be in unreferenced list", blobID)
			}
		}
	})
}

// TestGC_SweepPhase_SoftDelete 测试 GC SweepPhase 软删除功能
func TestGC_SweepPhase_SoftDelete(t *testing.T) {
	db := setupTestDB(t)
	_, manifestID, blobIDs := setupTestData(t, db)

	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")
	os.MkdirAll(filepath.Join(dataDir, "blobs", "sha256"), 0755)

	// 创建 blob 文件
	for _, digest := range []string{"blob1abc123", "blob2def456", "config789"} {
		path := filepath.Join(dataDir, "blobs", "sha256", digest)
		os.WriteFile(path, []byte("test data"), 0644)
	}

	gcSvc := NewGCServiceWithOptions(db, dataDir, GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    24 * time.Hour,
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	// 删除关联和 ref_count
	if err := db.Where("manifest_id = ?", manifestID).Delete(&model.OciManifestBlob{}).Error; err != nil {
		t.Fatalf("failed to delete manifest-blob links: %v", err)
	}
	for _, blobID := range blobIDs {
		if err := db.Model(&model.OciBlob{}).Where("id = ?", blobID).Update("ref_count", 0).Error; err != nil {
			t.Fatalf("failed to update blob ref_count: %v", err)
		}
	}

	t.Run("sweep phase dry run", func(t *testing.T) {
		var deleted, freedSize int64
		err := db.Transaction(func(tx *gorm.DB) error {
			marks, err := gcSvc.MarkPhase(tx)
			if err != nil {
				return err
			}
			deleted, freedSize, err = gcSvc.SweepPhase(tx, marks, true)
			return err
		})
		if err != nil {
			t.Fatalf("sweep phase failed: %v", err)
		}

		if deleted != 3 {
			t.Errorf("expected 3 blobs to be marked for deletion, got %d", deleted)
		}
		if freedSize != 1024+2048+512 {
			t.Errorf("expected freed size %d, got %d", 1024+2048+512, freedSize)
		}

		// 验证 blob 未被实际删除
		var blobCount int64
		db.Model(&model.OciBlob{}).Count(&blobCount)
		if blobCount != 3 {
			t.Errorf("expected 3 blobs, got %d", blobCount)
		}
	})

	t.Run("sweep phase actual soft delete", func(t *testing.T) {
		var deleted, freedSize int64
		err := db.Transaction(func(tx *gorm.DB) error {
			marks, err := gcSvc.MarkPhase(tx)
			if err != nil {
				return err
			}
			deleted, freedSize, err = gcSvc.SweepPhase(tx, marks, false)
			return err
		})
		if err != nil {
			t.Fatalf("sweep phase failed: %v", err)
		}

		if deleted != 3 {
			t.Errorf("expected 3 blobs to be soft deleted, got %d", deleted)
		}
		// Suppress unused variable warning
		_ = freedSize

		// 验证 blob 被标记为软删除
		for _, blobID := range blobIDs {
			var blob model.OciBlob
			if err := db.First(&blob, blobID).Error; err != nil {
				t.Fatalf("failed to get blob %d: %v", blobID, err)
			}
			if blob.DeletedAt == nil {
				t.Errorf("blob %d should have deleted_at set", blobID)
			}
		}

		// 验证 GC 候选记录已创建
		var candidates []model.GcCandidate
		if err := db.Find(&candidates).Error; err != nil {
			t.Fatalf("failed to get gc candidates: %v", err)
		}
		if len(candidates) != 3 {
			t.Errorf("expected 3 gc candidates, got %d", len(candidates))
		}
	})
}

// TestGC_CleanupSoftDeleted 测试 CleanupSoftDeleted 功能
func TestGC_CleanupSoftDeleted(t *testing.T) {
	db := setupTestDB(t)
	_, manifestID, blobIDs := setupTestData(t, db)

	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")
	os.MkdirAll(filepath.Join(dataDir, "blobs", "sha256"), 0755)

	// 创建 blob 文件
	for _, digest := range []string{"blob1abc123", "blob2def456", "config789"} {
		path := filepath.Join(dataDir, "blobs", "sha256", digest)
		os.WriteFile(path, []byte("test data"), 0644)
	}

	// 使用较短的软删除延迟以便测试
	gcSvc := NewGCServiceWithOptions(db, dataDir, GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    0, // 立即清理
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	// 删除 manifest-blob 关联（确保 blob 真正没有被引用）
	if err := db.Where("manifest_id = ?", manifestID).Delete(&model.OciManifestBlob{}).Error; err != nil {
		t.Fatalf("failed to delete manifest-blob links: %v", err)
	}

	// 将 blob 标记为软删除
	oldTime := time.Now().Add(-1 * time.Hour)
	for _, blobID := range blobIDs {
		if err := db.Model(&model.OciBlob{}).Where("id = ?", blobID).Update("deleted_at", oldTime).Error; err != nil {
			t.Fatalf("failed to mark blob as soft deleted: %v", err)
		}
	}

	// 创建 GC 候选记录
	for _, blobID := range blobIDs {
		var blob model.OciBlob
		if err := db.First(&blob, blobID).Error; err != nil {
			t.Fatalf("failed to get blob: %v", err)
		}
		candidate := model.GcCandidate{
			BlobID:    blobID,
			Digest:    blob.Digest,
			Size:      blob.Size,
			Reason:    "test",
			CreatedAt: oldTime,
		}
		if err := db.Create(&candidate).Error; err != nil {
			t.Fatalf("failed to create gc candidate: %v", err)
		}
	}

	t.Run("cleanup soft deleted blobs", func(t *testing.T) {
		deleted, freedSize, err := gcSvc.CleanupSoftDeleted()
		if err != nil {
			t.Fatalf("cleanup soft deleted failed: %v", err)
		}

		if deleted != 3 {
			t.Errorf("expected 3 blobs to be cleaned up, got %d", deleted)
		}
		if freedSize != 1024+2048+512 {
			t.Errorf("expected freed size %d, got %d", 1024+2048+512, freedSize)
		}

		// 验证 blob 已删除
		var blobCount int64
		db.Model(&model.OciBlob{}).Count(&blobCount)
		if blobCount != 0 {
			t.Errorf("expected 0 blobs, got %d", blobCount)
		}

		// 验证 GC 候选记录已删除
		var candidateCount int64
		db.Model(&model.GcCandidate{}).Count(&candidateCount)
		if candidateCount != 0 {
			t.Errorf("expected 0 gc candidates, got %d", candidateCount)
		}

		// 验证文件已删除
		for _, digest := range []string{"blob1abc123", "blob2def456", "config789"} {
			path := filepath.Join(dataDir, "blobs", "sha256", digest)
			if _, err := os.Stat(path); !os.IsNotExist(err) {
				t.Errorf("blob file %s should be deleted", digest)
			}
		}
	})
}

// TestGC_FullWorkflow 测试完整 GC 流程
func TestGC_FullWorkflow(t *testing.T) {
	db := setupTestDB(t)
	_, manifestID, blobIDs := setupTestData(t, db)

	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")
	os.MkdirAll(filepath.Join(dataDir, "blobs", "sha256"), 0755)

	// 创建 blob 文件
	for _, digest := range []string{"blob1abc123", "blob2def456", "config789"} {
		path := filepath.Join(dataDir, "blobs", "sha256", digest)
		os.WriteFile(path, []byte("test data"), 0644)
	}

	gcSvc := NewGCServiceWithOptions(db, dataDir, GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    0, // 立即清理以便测试
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	ctx := context.Background()

	// 1. 删除 manifest-blob 关联
	if err := db.Where("manifest_id = ?", manifestID).Delete(&model.OciManifestBlob{}).Error; err != nil {
		t.Fatalf("failed to delete manifest-blob links: %v", err)
	}
	for _, blobID := range blobIDs {
		if err := db.Model(&model.OciBlob{}).Where("id = ?", blobID).Update("ref_count", 0).Error; err != nil {
			t.Fatalf("failed to update blob ref_count: %v", err)
		}
	}

	// 2. 执行 GC
	result, err := gcSvc.RunGCWithOptions(false)
	if err != nil {
		t.Fatalf("run gc failed: %v", err)
	}

	// 3. 验证结果
	if result.CandidateCount != 3 {
		t.Errorf("expected 3 candidates, got %d", result.CandidateCount)
	}
	if result.DeletedCount != 3 {
		t.Errorf("expected 3 deleted, got %d", result.DeletedCount)
	}

	// 4. 验证 blob 已删除（因为 softDeleteDelay 为 0，会立即清理）
	var blobCount int64
	db.Model(&model.OciBlob{}).Count(&blobCount)
	if blobCount != 0 {
		t.Errorf("expected 0 blobs after gc, got %d", blobCount)
	}

	// 5. 验证状态记录
	statuses, err := gcSvc.GetGCStatus(1)
	if err != nil {
		t.Fatalf("get gc status failed: %v", err)
	}
	if len(statuses) != 1 {
		t.Errorf("expected 1 gc status record, got %d", len(statuses))
	}
	if statuses[0].Status != "completed" {
		t.Errorf("expected status 'completed', got '%s'", statuses[0].Status)
	}

	// 避免 ctx 未使用
	_ = ctx
}

// TestGC_RestoreCandidate 测试 RestoreCandidate 功能
func TestGC_RestoreCandidate(t *testing.T) {
	db := setupTestDB(t)
	_, _, blobIDs := setupTestData(t, db)

	tmpDir := t.TempDir()
	dataDir := filepath.Join(tmpDir, "oci")

	gcSvc := NewGCServiceWithOptions(db, dataDir, GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    24 * time.Hour,
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	// 将 blob 标记为软删除
	for _, blobID := range blobIDs {
		if err := db.Model(&model.OciBlob{}).Where("id = ?", blobID).Update("deleted_at", time.Now()).Error; err != nil {
			t.Fatalf("failed to mark blob as soft deleted: %v", err)
		}
	}

	// 创建 GC 候选记录
	var candidateID uint
	for i, blobID := range blobIDs {
		var blob model.OciBlob
		if err := db.First(&blob, blobID).Error; err != nil {
			t.Fatalf("failed to get blob: %v", err)
		}
		candidate := model.GcCandidate{
			BlobID:    blobID,
			Digest:    blob.Digest,
			Size:      blob.Size,
			Reason:    "test",
			CreatedAt: time.Now(),
		}
		if err := db.Create(&candidate).Error; err != nil {
			t.Fatalf("failed to create gc candidate: %v", err)
		}
		if i == 0 {
			candidateID = candidate.ID
		}
	}

	// 恢复第一个候选
	err := gcSvc.RestoreCandidate(candidateID)
	if err != nil {
		t.Fatalf("restore candidate failed: %v", err)
	}

	// 验证 blob 的 deleted_at 已被清除
	var restoredBlob model.OciBlob
	if err := db.First(&restoredBlob, blobIDs[0]).Error; err != nil {
		t.Fatalf("failed to get restored blob: %v", err)
	}
	if restoredBlob.DeletedAt != nil {
		t.Error("restored blob should not have deleted_at")
	}

	// 验证候选记录已删除
	var candidate model.GcCandidate
	err = db.First(&candidate, candidateID).Error
	if err == nil {
		t.Error("gc candidate should be deleted")
	}
}

func TestPushManifest_DoesNotDoubleCountExistingLinks(t *testing.T) {
	db := setupTestDB(t)
	settingSvc := setupTestSettingService(db)
	svc := NewWithOptions(db, t.TempDir(), settingSvc, GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    24 * time.Hour,
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	adminUser := model.User{Username: "admin", IsAdmin: true}
	if err := db.Create(&adminUser).Error; err != nil {
		t.Fatalf("failed to create admin user: %v", err)
	}

	ctx := context.Background()
	blobContent := []byte("layer-1")
	configContent := []byte("config-1")

	layerDigest := "sha256:" + mustSHA256(blobContent)
	configDigest := "sha256:" + mustSHA256(configContent)

	if err := svc.PushBlob(ctx, layerDigest, bytesReader(blobContent)); err != nil {
		t.Fatalf("push layer blob failed: %v", err)
	}
	if err := svc.PushBlob(ctx, configDigest, bytesReader(configContent)); err != nil {
		t.Fatalf("push config blob failed: %v", err)
	}

	manifest := mustJSON(map[string]any{
		"schemaVersion": 2,
		"mediaType":     "application/vnd.docker.distribution.manifest.v2+json",
		"config": map[string]any{
			"mediaType": "application/vnd.oci.image.config.v1+json",
			"digest":    configDigest,
			"size":      len(configContent),
		},
		"layers": []map[string]any{
			{
				"mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
				"digest":    layerDigest,
				"size":      len(blobContent),
			},
		},
	})

	for i := 0; i < 2; i++ {
		if _, err := svc.PushManifest(ctx, "test/repo", "latest", "application/vnd.docker.distribution.manifest.v2+json", []byte(manifest), adminUser.ID, adminUser.Username); err != nil {
			t.Fatalf("push manifest #%d failed: %v", i+1, err)
		}
	}

	var blobs []model.OciBlob
	if err := db.Order("digest ASC").Find(&blobs).Error; err != nil {
		t.Fatalf("failed to query blobs: %v", err)
	}
	if len(blobs) != 2 {
		t.Fatalf("expected 2 blobs, got %d", len(blobs))
	}
	for _, blob := range blobs {
		if blob.RefCount != 1 {
			t.Fatalf("blob %s ref_count expected 1, got %d", blob.Digest, blob.RefCount)
		}
	}
}

func TestPushManifest_ReplacesTagAndReleasesPreviousManifest(t *testing.T) {
	db := setupTestDB(t)
	settingSvc := setupTestSettingService(db)
	svc := NewWithOptions(db, t.TempDir(), settingSvc, GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    24 * time.Hour,
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	adminUser := model.User{Username: "admin", IsAdmin: true}
	if err := db.Create(&adminUser).Error; err != nil {
		t.Fatalf("failed to create admin user: %v", err)
	}

	ctx := context.Background()

	pushManifest := func(layerPayload, configPayload string) string {
		layerDigest := "sha256:" + mustSHA256([]byte(layerPayload))
		configDigest := "sha256:" + mustSHA256([]byte(configPayload))

		if err := svc.PushBlob(ctx, layerDigest, bytesReader([]byte(layerPayload))); err != nil {
			t.Fatalf("push layer blob failed: %v", err)
		}
		if err := svc.PushBlob(ctx, configDigest, bytesReader([]byte(configPayload))); err != nil {
			t.Fatalf("push config blob failed: %v", err)
		}

		manifest := mustJSON(map[string]any{
			"schemaVersion": 2,
			"mediaType":     "application/vnd.docker.distribution.manifest.v2+json",
			"config": map[string]any{
				"mediaType": "application/vnd.oci.image.config.v1+json",
				"digest":    configDigest,
				"size":      len(configPayload),
			},
			"layers": []map[string]any{
				{
					"mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
					"digest":    layerDigest,
					"size":      len(layerPayload),
				},
			},
		})

		digest, err := svc.PushManifest(ctx, "test/repo", "latest", "application/vnd.docker.distribution.manifest.v2+json", []byte(manifest), adminUser.ID, adminUser.Username)
		if err != nil {
			t.Fatalf("push manifest failed: %v", err)
		}
		return digest
	}

	firstDigest := pushManifest("layer-a", "config-a")
	secondDigest := pushManifest("layer-b", "config-b")
	if firstDigest == secondDigest {
		t.Fatal("expected different manifest digests after replacing tag")
	}

	var firstManifest model.OciManifest
	if err := db.Where("digest = ?", firstDigest).First(&firstManifest).Error; err == nil {
		t.Fatalf("expected old manifest %s to be removed after tag replacement", firstDigest)
	}

	var candidates []model.GcCandidate
	if err := db.Find(&candidates).Error; err != nil {
		t.Fatalf("failed to query gc candidates: %v", err)
	}
	if len(candidates) != 2 {
		t.Fatalf("expected 2 gc candidates for replaced manifest blobs, got %d", len(candidates))
	}

	var activeTag model.OciTag
	if err := db.Where("tag = ?", "latest").First(&activeTag).Error; err != nil {
		t.Fatalf("failed to query active tag: %v", err)
	}
	if activeTag.ManifestDigest != secondDigest {
		t.Fatalf("expected latest tag to point to %s, got %s", secondDigest, activeTag.ManifestDigest)
	}
}

func TestDeleteManifest_ByDigestRemovesImageAndMarksBlobsForGC(t *testing.T) {
	db := setupTestDB(t)
	repoID, manifestID, blobIDs := setupTestData(t, db)

	svc := NewWithOptions(db, t.TempDir(), setupTestSettingService(db), GCOptions{
		SoftDelete:         true,
		SoftDeleteDelay:    24 * time.Hour,
		EnableAutoGC:       false,
		MinUnreferencedAge: 0,
	})

	adminUser := model.User{Username: "admin", IsAdmin: true}
	if err := db.Create(&adminUser).Error; err != nil {
		t.Fatalf("failed to create admin user: %v", err)
	}

	if err := svc.DeleteManifest(context.Background(), "test/repo", "sha256:manifest123", adminUser.ID); err != nil {
		t.Fatalf("delete manifest by digest failed: %v", err)
	}

	var tagCount int64
	if err := db.Model(&model.OciTag{}).Where("repository_id = ?", repoID).Count(&tagCount).Error; err != nil {
		t.Fatalf("failed to count tags: %v", err)
	}
	if tagCount != 0 {
		t.Fatalf("expected tags to be removed, got %d", tagCount)
	}

	var manifest model.OciManifest
	if err := db.First(&manifest, manifestID).Error; err == nil {
		t.Fatal("expected manifest to be deleted")
	}

	verifyBlobRefCounts(t, db, blobIDs, []int64{0, 0, 0})

	var candidateCount int64
	if err := db.Model(&model.GcCandidate{}).Count(&candidateCount).Error; err != nil {
		t.Fatalf("failed to count gc candidates: %v", err)
	}
	if candidateCount != 3 {
		t.Fatalf("expected 3 gc candidates, got %d", candidateCount)
	}
}

// Helper function to marshal JSON
func mustJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func mustSHA256(content []byte) string {
	sum := sha256.Sum256(content)
	return fmt.Sprintf("%x", sum[:])
}

func bytesReader(b []byte) *bytes.Reader {
	return bytes.NewReader(b)
}
