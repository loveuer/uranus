package oci

import (
	"log"
	"os"
	"path/filepath"
	"time"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/model"
	"gorm.io/gorm"
)

// GCService 提供 OCI 层的垃圾回收能力
type GCService struct {
	db      *gorm.DB
	dataDir string // 数据根目录下的 OCI 数据目录

	// 配置选项
	softDelete         bool          // 是否启用软删除
	softDeleteDelay    time.Duration // 软删除延迟时间（多久后真正删除）
	enableAutoGC       bool          // 是否启用自动 GC
	autoGCInterval     time.Duration // 自动 GC 间隔
	stopChan           chan struct{} // 停止信号
	isRunning          bool          // GC 是否正在运行
	minUnreferencedAge time.Duration // 最小无引用时间才允许删除
}

// GCOptions GC 配置选项
type GCOptions struct {
	SoftDelete         bool
	SoftDeleteDelay    time.Duration
	EnableAutoGC       bool
	AutoGCInterval     time.Duration
	MinUnreferencedAge time.Duration
}

// DefaultGCOptions 返回默认 GC 配置
func DefaultGCOptions() GCOptions {
	return GCOptions{
		SoftDelete:         true,               // 默认启用软删除
		SoftDeleteDelay:    24 * time.Hour,     // 默认延迟 24 小时删除
		EnableAutoGC:       true,               // 默认启用自动 GC
		AutoGCInterval:     6 * time.Hour,      // 默认每 6 小时运行一次
		MinUnreferencedAge: 30 * time.Minute,   // 最小无引用时间 30 分钟
	}
}

// NewGCService 创建 GC 服务
func NewGCService(db *gorm.DB, dataDir string) *GCService {
	return NewGCServiceWithOptions(db, dataDir, DefaultGCOptions())
}

// NewGCServiceWithOptions 创建带配置的 GC 服务
func NewGCServiceWithOptions(db *gorm.DB, dataDir string, opts GCOptions) *GCService {
	g := &GCService{
		db:                 db,
		dataDir:            dataDir,
		softDelete:         opts.SoftDelete,
		softDeleteDelay:    opts.SoftDeleteDelay,
		enableAutoGC:       opts.EnableAutoGC,
		autoGCInterval:     opts.AutoGCInterval,
		minUnreferencedAge: opts.MinUnreferencedAge,
		stopChan:           make(chan struct{}),
	}

	// 如果启用自动 GC，启动定时任务
	if opts.EnableAutoGC {
		g.StartAutoGC()
	}

	return g
}

// blobPath 构造 blob 在磁盘上的路径
func (g *GCService) blobPath(digest string) string {
	hash := digest
	if len(digest) > 7 && digest[:7] == "sha256:" {
		hash = digest[7:]
	}
	return filepath.Join(g.dataDir, "blobs", "sha256", hash)
}

// StartAutoGC 启动自动 GC 定时任务
func (g *GCService) StartAutoGC() {
	if g.isRunning {
		return
	}
	g.isRunning = true

	go func() {
		ticker := time.NewTicker(g.autoGCInterval)
		defer ticker.Stop()

		// 启动时立即执行一次 GC
		log.Printf("[gc] auto gc started, interval: %v", g.autoGCInterval)
		if err := g.RunGC(false); err != nil {
			log.Printf("[gc] initial gc failed: %v", err)
		}

		for {
			select {
			case <-ticker.C:
				log.Printf("[gc] running scheduled gc...")
				if err := g.RunGC(false); err != nil {
					log.Printf("[gc] scheduled gc failed: %v", err)
				}
			case <-g.stopChan:
				log.Printf("[gc] auto gc stopped")
				return
			}
		}
	}()
}

// StopAutoGC 停止自动 GC
func (g *GCService) StopAutoGC() {
	if !g.isRunning {
		return
	}
	g.isRunning = false
	close(g.stopChan)
}

// IsAutoGCRunning 返回自动 GC 是否正在运行
func (g *GCService) IsAutoGCRunning() bool {
	return g.isRunning
}

// MarkPhase 标记阶段：遍历所有 manifest，标记被引用的 blob
// 返回被引用的 blob ID 集合
func (g *GCService) MarkPhase(tx *gorm.DB) (map[uint]bool, error) {
	marks := make(map[uint]bool)

	// 1. 从 manifest-blob 关联表获取所有被引用的 blob
	var links []model.OciManifestBlob
	if err := tx.Find(&links).Error; err != nil {
		return nil, err
	}
	for _, l := range links {
		marks[l.BlobID] = true
	}

	// 2. 补充：标记所有 ref_count > 0 的 blob（双重保险）
	var activeBlobs []model.OciBlob
	if err := tx.Where("ref_count > 0").Find(&activeBlobs).Error; err != nil {
		return nil, err
	}
	for _, b := range activeBlobs {
		marks[b.ID] = true
	}

	return marks, nil
}

// FindUnreferencedBlobs 查找所有未被引用的 blob
func (g *GCService) FindUnreferencedBlobs(tx *gorm.DB) ([]model.OciBlob, error) {
	marks, err := g.MarkPhase(tx)
	if err != nil {
		return nil, err
	}

	var allBlobs []model.OciBlob
	if err := tx.Find(&allBlobs).Error; err != nil {
		return nil, err
	}

	var unreferenced []model.OciBlob
	for _, b := range allBlobs {
		if !marks[b.ID] {
			// 检查是否满足最小无引用时间要求
			if g.minUnreferencedAge > 0 {
				// 计算最后一次被引用的可能时间（使用 UpdatedAt 或 CreatedAt）
				lastRefTime := b.UpdatedAt
				if lastRefTime.IsZero() {
					lastRefTime = b.CreatedAt
				}
				if time.Since(lastRefTime) < g.minUnreferencedAge {
					// 跳过：未满足最小无引用时间
					continue
				}
			}
			unreferenced = append(unreferenced, b)
		}
	}

	return unreferenced, nil
}

// MarkForGC 将 blob 标记为待删除（软删除）
func (g *GCService) MarkForGC(tx *gorm.DB, blobs []model.OciBlob, reason string) error {
	now := time.Now()

	for _, b := range blobs {
		// 1. 标记 blob 为软删除状态
		if err := tx.Model(&b).Update("deleted_at", now).Error; err != nil {
			return err
		}

		// 2. 添加到 GC 候选表（用于审计和恢复）
		candidate := model.GcCandidate{
			BlobID:         b.ID,
			Digest:         b.Digest,
			Size:           b.Size,
			Reason:         reason,
			RepositoryID:   b.RepositoryID,
			CreatedAt:      now,
		}
		if err := tx.Create(&candidate).Error; err != nil {
			// 忽略重复错误
			if !isDuplicateError(err) {
				return err
			}
		}
	}

	return nil
}

// SweepPhase 扫描并删除未被引用的 blob
// 根据配置决定是立即删除还是软删除
func (g *GCService) SweepPhase(tx *gorm.DB, marks map[uint]bool, dryRun bool) (deleted int64, freedSize int64, err error) {
	var blobs []model.OciBlob
	if err := tx.Find(&blobs).Error; err != nil {
		return 0, 0, err
	}

	var toDelete []model.OciBlob
	for _, b := range blobs {
		if !marks[b.ID] {
			// 检查是否满足最小无引用时间
			if g.minUnreferencedAge > 0 {
				lastRefTime := b.UpdatedAt
				if lastRefTime.IsZero() {
					lastRefTime = b.CreatedAt
				}
				if time.Since(lastRefTime) < g.minUnreferencedAge {
					continue
				}
			}
			toDelete = append(toDelete, b)
			freedSize += b.Size
		}
	}

	if len(toDelete) == 0 {
		return 0, 0, nil
	}

	if dryRun {
		return int64(len(toDelete)), freedSize, nil
	}

	if g.softDelete {
		// 软删除：只标记，不立即删除文件
		if err := g.MarkForGC(tx, toDelete, "unreferenced"); err != nil {
			return 0, 0, err
		}
	} else {
		// 立即删除
		if err := g.deleteBlobs(tx, toDelete); err != nil {
			return 0, 0, err
		}
	}

	return int64(len(toDelete)), freedSize, nil
}

// deleteBlobs 立即删除 blob 文件和数据库记录
func (g *GCService) deleteBlobs(tx *gorm.DB, blobs []model.OciBlob) error {
	var blobIDs []uint
	for _, b := range blobs {
		blobIDs = append(blobIDs, b.ID)

		// 删除磁盘文件
		path := g.blobPath(b.Digest)
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			log.Printf("[gc] failed to remove blob file %s: %v", path, err)
		}
	}

	if len(blobIDs) == 0 {
		return nil
	}

	// 清理关联表（理论上应该没有关联了，但保险起见）
	if err := tx.Where("blob_id IN (?)", blobIDs).Delete(&model.OciManifestBlob{}).Error; err != nil {
		return err
	}

	// 删除 blob 记录
	if err := tx.Where("id IN (?)", blobIDs).Delete(&model.OciBlob{}).Error; err != nil {
		return err
	}

	return nil
}

// CleanupSoftDeleted 清理已软删除且超过延迟时间的 blob
func (g *GCService) CleanupSoftDeleted() (deleted int64, freedSize int64, err error) {
	if !g.softDelete {
		return 0, 0, nil
	}

	cutoff := time.Now().Add(-g.softDeleteDelay)

	err = g.db.Transaction(func(tx *gorm.DB) error {
		// 1. 查找已软删除且超过延迟时间的 blob
		var candidates []model.GcCandidate
		if err := tx.Where("created_at < ?", cutoff).Find(&candidates).Error; err != nil {
			return err
		}

		if len(candidates) == 0 {
			return nil
		}

		// 2. 双重检查这些 blob 确实没有被引用
		for _, c := range candidates {
			// 检查是否还有 manifest 引用此 blob
			var count int64
			if err := tx.Model(&model.OciManifestBlob{}).Where("blob_id = ?", c.BlobID).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				// blob 被重新引用，从候选表中移除
				tx.Delete(&c)
				// 恢复 blob 状态
				tx.Model(&model.OciBlob{}).Where("id = ?", c.BlobID).Update("deleted_at", nil)
				continue
			}

			// 3. 删除 blob 文件
			path := g.blobPath(c.Digest)
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				log.Printf("[gc] failed to remove blob file %s: %v", path, err)
			}

			// 4. 删除 blob 记录
			if err := tx.Where("id = ?", c.BlobID).Delete(&model.OciBlob{}).Error; err != nil {
				return err
			}

			// 5. 从候选表删除
			if err := tx.Delete(&c).Error; err != nil {
				return err
			}

			deleted++
			freedSize += c.Size
		}

		return nil
	})

	return deleted, freedSize, err
}

// RunGC 执行完整 GC 流程（Mark -> Sweep）
// 若 dryRun 为真则仅统计，不做实际删除
func (g *GCService) RunGC(dryRun bool) error {
	// 记录 GC 执行历史
	status := model.GcStatus{
		StartedAt: time.Now(),
		Status:    "running",
		DryRun:    dryRun,
	}
	if err := g.db.Create(&status).Error; err != nil {
		return err
	}

	var marked int64
	var deleted int64
	var freed int64

	err := g.db.Transaction(func(tx *gorm.DB) error {
		// 1. Mark 阶段
		marks, err := g.MarkPhase(tx)
		if err != nil {
			return err
		}
		marked = int64(len(marks))

		// 2. Sweep 阶段
		d, f, err := g.SweepPhase(tx, marks, dryRun)
		if err != nil {
			return err
		}
		deleted = d
		freed = f

		// 3. 更新状态
		now := time.Now()
		updates := map[string]interface{}{
			"marked":     marked,
			"deleted":    deleted,
			"freed_size": freed,
			"status":     "completed",
			"ended_at":   &now,
		}
		if err := tx.Model(&model.GcStatus{}).Where("id = ?", status.ID).Updates(updates).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		now := time.Now()
		_ = g.db.Model(&model.GcStatus{}).Where("id = ?", status.ID).Updates(map[string]interface{}{
			"status":   "failed",
			"error":    err.Error(),
			"ended_at": &now,
		})
		return err
	}

	// 4. 如果是软删除模式，执行清理
	if g.softDelete && !dryRun {
		d, f, err := g.CleanupSoftDeleted()
		if err != nil {
			log.Printf("[gc] cleanup soft deleted failed: %v", err)
		} else if d > 0 {
			log.Printf("[gc] cleaned up %d soft deleted blobs, freed %d bytes", d, f)
		}
	}

	log.Printf("[gc] completed: marked=%d, deleted=%d, freed=%d bytes", marked, deleted, freed)
	return nil
}

// RunGCWithOptions 运行 GC 并返回详细结果
func (g *GCService) RunGCWithOptions(dryRun bool) (*GCResult, error) {
	status := model.GcStatus{
		StartedAt: time.Now(),
		Status:    "running",
		DryRun:    dryRun,
	}
	if err := g.db.Create(&status).Error; err != nil {
		return nil, err
	}

	result := &GCResult{
		StartedAt: status.StartedAt,
		DryRun:    dryRun,
	}

	err := g.db.Transaction(func(tx *gorm.DB) error {
		marks, err := g.MarkPhase(tx)
		if err != nil {
			return err
		}
		result.MarkedCount = int64(len(marks))

		unreferenced, err := g.FindUnreferencedBlobs(tx)
		if err != nil {
			return err
		}

		result.Candidates = make([]GCBlobInfo, 0, len(unreferenced))
		for _, b := range unreferenced {
			result.Candidates = append(result.Candidates, GCBlobInfo{
				ID:       b.ID,
				Digest:   b.Digest,
				Size:     b.Size,
				RefCount: b.RefCount,
			})
			result.TotalSize += b.Size
		}
		result.CandidateCount = int64(len(unreferenced))

		if !dryRun {
			if g.softDelete {
				if err := g.MarkForGC(tx, unreferenced, "gc"); err != nil {
					return err
				}
			} else {
				if err := g.deleteBlobs(tx, unreferenced); err != nil {
					return err
				}
			}
		}

		result.DeletedCount = result.CandidateCount
		result.FreedSize = result.TotalSize

		now := time.Now()
		result.EndedAt = now
		if err := tx.Model(&model.GcStatus{}).Where("id = ?", status.ID).Updates(map[string]interface{}{
			"marked":     result.MarkedCount,
			"deleted":    result.DeletedCount,
			"freed_size": result.FreedSize,
			"status":     "completed",
			"ended_at":   &now,
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		now := time.Now()
		_ = g.db.Model(&model.GcStatus{}).Where("id = ?", status.ID).Updates(map[string]interface{}{
			"status":   "failed",
			"error":    err.Error(),
			"ended_at": &now,
		})
		return nil, err
	}

	// 清理软删除的 blob
	if g.softDelete && !dryRun {
		d, f, err := g.CleanupSoftDeleted()
		if err != nil {
			log.Printf("[gc] cleanup soft deleted failed: %v", err)
		} else {
			result.SoftDeletedCleaned = d
			result.SoftDeletedFreed = f
		}
	}

	return result, nil
}

// GCResult GC 执行结果
type GCResult struct {
	StartedAt          time.Time    `json:"started_at"`
	EndedAt            time.Time    `json:"ended_at"`
	DryRun             bool         `json:"dry_run"`
	MarkedCount        int64        `json:"marked_count"`
	CandidateCount     int64        `json:"candidate_count"`
	DeletedCount       int64        `json:"deleted_count"`
	TotalSize          int64        `json:"total_size"`
	FreedSize          int64        `json:"freed_size"`
	Candidates         []GCBlobInfo `json:"candidates,omitempty"`
	SoftDeletedCleaned int64        `json:"soft_deleted_cleaned"`
	SoftDeletedFreed   int64        `json:"soft_deleted_freed"`
}

// GCBlobInfo GC 候选 blob 信息
type GCBlobInfo struct {
	ID       uint   `json:"id"`
	Digest   string `json:"digest"`
	Size     int64  `json:"size"`
	RefCount int64  `json:"ref_count"`
}

// GetGCStatus 获取最近的 GC 状态
func (g *GCService) GetGCStatus(limit int) ([]model.GcStatus, error) {
	var statuses []model.GcStatus
	err := g.db.Order("started_at DESC").Limit(limit).Find(&statuses).Error
	return statuses, err
}

// GetGCCandidates 获取当前待删除的 blob 列表
func (g *GCService) GetGCCandidates() ([]model.GcCandidate, error) {
	var candidates []model.GcCandidate
	err := g.db.Order("created_at DESC").Find(&candidates).Error
	return candidates, err
}

// RestoreCandidate 恢复一个被标记删除的 blob（从候选表移除并恢复 blob 状态）
func (g *GCService) RestoreCandidate(candidateID uint) error {
	return g.db.Transaction(func(tx *gorm.DB) error {
		var candidate model.GcCandidate
		if err := tx.First(&candidate, candidateID).Error; err != nil {
			return err
		}

		// 恢复 blob 的 deleted_at 字段
		if err := tx.Model(&model.OciBlob{}).Where("id = ?", candidate.BlobID).Update("deleted_at", nil).Error; err != nil {
			return err
		}

		// 删除候选记录
		return tx.Delete(&candidate).Error
	})
}

// isDuplicateError 检查是否为重复记录错误
func isDuplicateError(err error) bool {
	if err == nil {
		return false
	}
	// GORM 的 duplicate entry 错误通常包含 "duplicate" 关键字
	return len(err.Error()) > 0 && contains(err.Error(), "duplicate")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsAt(s, substr, 0))
}

func containsAt(s, substr string, start int) bool {
	if start >= len(s) {
		return false
	}
	if start+len(substr) > len(s) {
		return false
	}
	for i := 0; i < len(substr); i++ {
		if s[start+i] != substr[i] {
			return containsAt(s, substr, start+1)
		}
	}
	return true
}

// timePtr 返回一个指向 t 的指针，用于设置 EndedAt 字段
func timePtr(t time.Time) *time.Time {
	return &t
}
