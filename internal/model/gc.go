package model

import "time"

// GcStatus GC 执行状态
type GcStatus struct {
	ID        uint       `gorm:"primarykey"`
	StartedAt time.Time  `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at"`
	Status    string     `json:"status"` // running, completed, failed
	DryRun    bool       `json:"dry_run"`
	Marked    int64      `json:"marked"`
	Deleted   int64      `json:"deleted"`
	FreedSize int64      `json:"freed_size"`
	Error     string     `json:"error"`
}

func (GcStatus) TableName() string { return "gc_status" }

// GcCandidate 待删除的 blob 候选（软删除机制）
type GcCandidate struct {
	ID        uint       `gorm:"primarykey"`
	CreatedAt time.Time  `json:"created_at"`
	DeletedAt *time.Time `json:"deleted_at"` // 软删除时间

	BlobID   uint   `json:"blob_id" gorm:"index;not null"`
	Digest   string `json:"digest" gorm:"size:128;not null"`
	Size     int64  `json:"size"`
	Reason   string `json:"reason" gorm:"size:256"` // 删除原因

	// 关联信息（用于审计）
	RepositoryID   uint   `json:"repository_id"`
	RepositoryName string `json:"repository_name" gorm:"size:256"`
}

func (GcCandidate) TableName() string { return "gc_candidates" }
