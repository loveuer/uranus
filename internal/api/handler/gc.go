package handler

import (
	"strconv"

	"github.com/loveuer/ursa"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/model"
	oci "gitea.loveuer.com/loveuer/uranus/v2/internal/service/oci"
	"gorm.io/gorm"
)

// GCHandler 提供 GC 的 HTTP 接口
type GCHandler struct {
	db  *gorm.DB
	svc *oci.GCService
}

// NewGCHandler 创建 GC handler，复用已有的 GCService 实例
func NewGCHandler(db *gorm.DB, svc *oci.GCService) *GCHandler {
	return &GCHandler{
		db:  db,
		svc: svc,
	}
}

// Run POST /api/v1/gc/run - 执行 GC
func (h *GCHandler) Run(c *ursa.Ctx) error {
	if err := h.svc.RunGC(false); err != nil {
		return c.Status(500).JSON(ursa.Map{"error": err.Error()})
	}
	return c.JSON(ursa.Map{"ok": true, "dry_run": false})
}

// DryRun POST /api/v1/gc/dry-run - 模拟执行 GC（不实际删除）
func (h *GCHandler) DryRun(c *ursa.Ctx) error {
	result, err := h.svc.RunGCWithOptions(true)
	if err != nil {
		return c.Status(500).JSON(ursa.Map{"error": err.Error()})
	}
	return c.JSON(ursa.Map{
		"ok":                true,
		"dry_run":           true,
		"marked":            result.MarkedCount,
		"candidates":        result.CandidateCount,
		"total_size":        result.TotalSize,
		"candidates_detail": result.Candidates,
	})
}

// RunWithDetail POST /api/v1/gc/run-detail - 执行 GC 并返回详细结果
func (h *GCHandler) RunWithDetail(c *ursa.Ctx) error {
	result, err := h.svc.RunGCWithOptions(false)
	if err != nil {
		return c.Status(500).JSON(ursa.Map{"error": err.Error()})
	}
	return c.JSON(ursa.Map{
		"ok":                   true,
		"dry_run":              false,
		"started_at":           result.StartedAt,
		"ended_at":             result.EndedAt,
		"marked":               result.MarkedCount,
		"deleted":              result.DeletedCount,
		"freed_size":           result.FreedSize,
		"soft_deleted_cleaned": result.SoftDeletedCleaned,
		"soft_deleted_freed":   result.SoftDeletedFreed,
	})
}

// Status GET /api/v1/gc/status - 获取最近的 GC 状态
func (h *GCHandler) Status(c *ursa.Ctx) error {
	limitStr := c.Query("limit")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 {
		limit = 10
	}

	statuses, err := h.svc.GetGCStatus(limit)
	if err != nil {
		return c.Status(500).JSON(ursa.Map{"error": err.Error()})
	}

	return c.JSON(ursa.Map{
		"ok":     true,
		"status": statuses,
	})
}

// Candidates GET /api/v1/gc/candidates - 获取待删除的 blob 列表
func (h *GCHandler) Candidates(c *ursa.Ctx) error {
	candidates, err := h.svc.GetGCCandidates()
	if err != nil {
		return c.Status(500).JSON(ursa.Map{"error": err.Error()})
	}

	return c.JSON(ursa.Map{
		"ok":         true,
		"candidates": candidates,
	})
}

// Restore POST /api/v1/gc/restore?id={id} - 恢复被标记删除的 blob
func (h *GCHandler) Restore(c *ursa.Ctx) error {
	idStr := c.Query("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return c.Status(400).JSON(ursa.Map{"error": "invalid id"})
	}

	if err := h.svc.RestoreCandidate(uint(id)); err != nil {
		return c.Status(500).JSON(ursa.Map{"error": err.Error()})
	}

	return c.JSON(ursa.Map{"ok": true})
}

// AutoGCStatus GET /api/v1/gc/auto-status - 获取自动 GC 状态
func (h *GCHandler) AutoGCStatus(c *ursa.Ctx) error {
	return c.JSON(ursa.Map{
		"ok":      true,
		"running": h.svc.IsAutoGCRunning(),
	})
}

// UnreferencedBlobs GET /api/v1/gc/unreferenced - 获取当前未被引用的 blob 列表
func (h *GCHandler) UnreferencedBlobs(c *ursa.Ctx) error {
	var blobs []model.OciBlob
	err := h.db.Transaction(func(tx *gorm.DB) error {
		unreferenced, err := h.svc.FindUnreferencedBlobs(tx)
		if err != nil {
			return err
		}
		blobs = unreferenced
		return nil
	})

	if err != nil {
		return c.Status(500).JSON(ursa.Map{"error": err.Error()})
	}

	var totalSize int64
	for _, b := range blobs {
		totalSize += b.Size
	}

	return c.JSON(ursa.Map{
		"ok":         true,
		"count":      len(blobs),
		"total_size": totalSize,
		"blobs":      blobs,
	})
}
