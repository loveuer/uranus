package model

import (
	"time"

	"gorm.io/gorm"
)

// PyPIRepository PyPI 仓库（如 pypi, tsinghua mirror 等）
type PyPIRepository struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	Name        string `json:"name" gorm:"uniqueIndex;size:128;not null"` // 仓库名称
	Description string `json:"description" gorm:"size:512"`               // 描述
	Upstream    string `json:"upstream" gorm:"size:256"`                  // 上游地址，如 https://pypi.org/simple
	Enabled     bool   `json:"enabled" gorm:"default:true"`               // 是否启用

	// 存储路径（相对于 dataDir）
	StoragePath string `json:"storage_path" gorm:"size:256;default:'pypi'"`
}

func (PyPIRepository) TableName() string { return "pypi_repositories" }

// PyPIPackages PyPI 包（如 requests, django 等）
type PyPIPackage struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	Name        string `json:"name" gorm:"index;size:256;not null"` // 包名（标准化格式：小写，-代替_）
	Summary     string `json:"summary" gorm:"size:1024"`            // 包描述
	HomePage    string `json:"home_page" gorm:"size:512"`           // 项目主页
	License     string `json:"license" gorm:"size:256"`             // 许可证
	Author      string `json:"author" gorm:"size:256"`              // 作者
	AuthorEmail string `json:"author_email" gorm:"size:256"`        // 作者邮箱

	// 所属仓库
	RepositoryID uint          `json:"repository_id" gorm:"index;not null"`
	Repository   PyPIRepository `json:"-" gorm:"foreignKey:RepositoryID"`

	// 是否为本地上传的包
	IsUploaded bool `json:"is_uploaded" gorm:"default:false"`

	// 上传者信息（本地上传时记录）
	UploaderID uint   `json:"uploader_id" gorm:"index"`
	Uploader   string `json:"uploader" gorm:"size:64"`

	// 版本列表（通过关联表）
	Versions []PyPIVersion `json:"versions,omitempty" gorm:"foreignKey:PackageID"`
}

func (PyPIPackage) TableName() string { return "pypi_packages" }

// PyPIVersion PyPI 包版本（如 1.0.0, 2.1.0rc1 等）
type PyPIVersion struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`

	// 所属包
	PackageID uint        `json:"package_id" gorm:"index;not null"`
	Package   PyPIPackage `json:"-" gorm:"foreignKey:PackageID"`

	// 版本号
	Version string `json:"version" gorm:"index;size:64;not null"` // 如 1.0.0, 2.1.0rc1

	// 发布信息
	RequiresPython string `json:"requires_python" gorm:"size:64"` // Python 版本要求
	ReleaseURL     string `json:"release_url" gorm:"size:512"`    // 发布页面 URL
	Yanked         bool   `json:"yanked" gorm:"default:false"`    // 是否被撤销

	// 文件列表（该版本的所有分发文件）
	Files []PyPIFile `json:"files,omitempty" gorm:"foreignKey:VersionID"`
}

func (PyPIVersion) TableName() string { return "pypi_versions" }

// PyPIFile PyPI 包文件（如 .tar.gz, .whl 等）
type PyPIFile struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`

	// 所属版本
	VersionID uint        `json:"version_id" gorm:"index;not null"`
	Version   PyPIVersion `json:"-" gorm:"foreignKey:VersionID"`

	// 文件名
	Filename string `json:"filename" gorm:"size:256;not null"` // 如 requests-2.28.0-py3-none-any.whl

	// 文件信息
	Path   string `json:"path" gorm:"size:512;not null"` // 相对存储路径
	Size   int64  `json:"size"`                          // 文件大小
	MD5    string `json:"md5" gorm:"size:32"`            // MD5 校验和
	SHA256 string `json:"sha256" gorm:"size:64"`         // SHA256 校验和

	// 文件类型
	Packagetype string `json:"packagetype" gorm:"size:32"` // sdist, bdist_wheel 等
	PythonVersion   string `json:"python_version" gorm:"size:32"` // py3, cp39, source 等
	Platform        string `json:"platform" gorm:"size:128"`      // any, linux_x86_64 等

	// 上传信息
	UploadTime          time.Time `json:"upload_time" gorm:"autoCreateTime"` // 上传时间
	UploadTimeFormatted string    `json:"upload_time_formatted" gorm:"size:20"` // ISO 8601 格式

	// 是否已缓存到本地
	Cached bool `json:"cached" gorm:"default:false"`

	// 来源信息
	IsUploaded bool `json:"is_uploaded" gorm:"default:false"` // 是否为本地上传
}

func (PyPIFile) TableName() string { return "pypi_files" }
