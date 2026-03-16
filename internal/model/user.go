package model

import (
	"time"

	"gorm.io/gorm"
)

// UserUploadModules 用户可上传模块列表（用于 JSON 序列化）
type UserUploadModules []Module

// User 用户模型
type User struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	Username       string            `json:"username" gorm:"uniqueIndex;size:64;not null"`
	Password       string            `json:"-" gorm:"size:128;not null"`
	Email          string            `json:"email" gorm:"size:128"`
	IsAdmin        bool              `json:"is_admin" gorm:"default:false"`
	Status         int               `json:"status" gorm:"default:1"` // 1: active, 0: disabled
	UploadModules  UserUploadModules `json:"upload_modules" gorm:"type:text;serializer:json"` // 可上传的模块列表
}

// CanUpload 检查用户是否可以上传指定模块
// 管理员可以上传所有模块，普通用户需要检查是否在允许列表中
func (u *User) CanUpload(module Module) bool {
	if u.IsAdmin {
		return true
	}
	if u.Status != 1 {
		return false
	}
	for _, m := range u.UploadModules {
		if m == module {
			return true
		}
	}
	return false
}

// CanUploadAny 检查用户是否有任何上传权限
func (u *User) CanUploadAny() bool {
	if u.IsAdmin {
		return true
	}
	return len(u.UploadModules) > 0 && u.Status == 1
}

func (User) TableName() string {
	return "users"
}
