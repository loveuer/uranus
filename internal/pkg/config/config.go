package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultBodySize    int64 = 1 << 30 // 1 GB
	defaultJWTSecret         = "ufshare-secret-key-change-in-production"
)

type Config struct {
	Debug      bool
	Address    string // 监听地址，如 0.0.0.0:9817
	Data       string // 数据目录，存放上传文件和数据库
	DB         string // 数据库连接：SQLite 路径 / MySQL DSN / PostgreSQL DSN
	NpmAddr    string // npm 专用端口，如 0.0.0.0:4873（可选）
	FileAddr   string // file-store 专用端口，如 0.0.0.0:8001（可选）
	GoAddr     string // go 模块代理专用端口，如 0.0.0.0:8081（可选）
	OciAddr    string // OCI/Docker 镜像代理专用端口，如 0.0.0.0:5000（可选）
	MavenAddr  string // Maven 仓库专用端口，如 0.0.0.0:8082（可选）
	PyPIAddr   string // PyPI 仓库专用端口，如 0.0.0.0:8083（可选）
	BodySize   int64  // 请求体大小限制（字节），-1 表示不限制
	Database   DatabaseConfig
	JWT        JWTConfig
}

type DatabaseConfig struct {
	Driver string // sqlite, mysql, postgres
	DSN    string
}

type JWTConfig struct {
	Secret string
	Expire time.Duration
}

func Load() *Config {
	return &Config{
		Address: getEnv("UFSHARE_ADDRESS", "0.0.0.0:9817"),
		Data:    getEnv("UFSHARE_DATA", "."),
		DB:      getEnv("UFSHARE_DB", ""),
		Database: DatabaseConfig{
			Driver: getEnv("DB_DRIVER", ""),
			DSN:    getEnv("DB_DSN", ""),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", ""),
			Expire: 24 * time.Hour,
		},
		BodySize: parseBodySize(getEnv("BODY_SIZE", "1GB")),
	}
}

// ParseDB 解析数据库连接字符串，自动检测类型
// 支持格式：
//   - SQLite: 文件路径，如 /path/to/db.sqlite 或 ./data.db
//   - MySQL: mysql://user:pass@host:port/dbname 或 user:pass@tcp(host:port)/dbname
//   - PostgreSQL: postgres://user:pass@host:port/dbname 或 postgresql://...
func ParseDB(db string, dataDir string) (driver, dsn string, err error) {
	if db == "" {
		// 默认使用 SQLite
		return "sqlite", filepath.Join(dataDir, "ufshare.db"), nil
	}

	db = strings.TrimSpace(db)

	// 检查 URL scheme
	if strings.HasPrefix(db, "mysql://") {
		// MySQL URL 格式: mysql://user:pass@host:port/dbname
		u, parseErr := url.Parse(db)
		if parseErr != nil {
			return "", "", fmt.Errorf("invalid mysql dsn: %w", parseErr)
		}
		// 转换为 Go MySQL DSN 格式: user:pass@tcp(host:port)/dbname
		password, _ := u.User.Password()
		dsn = fmt.Sprintf("%s:%s@tcp(%s)%s?parseTime=true",
			u.User.Username(),
			password,
			u.Host,
			u.Path,
		)
		return "mysql", dsn, nil
	}

	if strings.HasPrefix(db, "postgres://") || strings.HasPrefix(db, "postgresql://") {
		// PostgreSQL URL 格式，直接使用
		return "postgres", db, nil
	}

	// 检查是否是 MySQL DSN 格式 (user:pass@tcp(host:port)/dbname)
	if strings.Contains(db, "@tcp(") || strings.Contains(db, "@unix(") {
		// 已经是 Go MySQL DSN 格式
		dsn = db
		if !strings.Contains(dsn, "parseTime") {
			if strings.Contains(dsn, "?") {
				dsn += "&parseTime=true"
			} else {
				dsn += "?parseTime=true"
			}
		}
		return "mysql", dsn, nil
	}

	// 检查是否是 PostgreSQL key=value 格式
	if strings.Contains(db, "host=") || strings.Contains(db, "user=") {
		return "postgres", db, nil
	}

	// 其他情况视为 SQLite 文件路径
	// 如果是相对路径，基于 dataDir
	if !filepath.IsAbs(db) {
		db = filepath.Join(dataDir, db)
	}

	return "sqlite", db, nil
}

// Finalize 在命令行 flag 解析完成后调用，补全运行时依赖 Data 才能确定的默认值
func (c *Config) Finalize() {
	// 如果通过 DB 字段指定了数据库，解析它
	if c.DB != "" {
		driver, dsn, err := ParseDB(c.DB, c.Data)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing database: %v\n", err)
			os.Exit(1)
		}
		c.Database.Driver = driver
		c.Database.DSN = dsn
		return
	}

	// 兼容旧的环境变量方式
	if c.Database.Driver != "" && c.Database.DSN != "" {
		return
	}

	// 默认使用 SQLite
	if c.Database.Driver == "" {
		c.Database.Driver = "sqlite"
	}
	if c.Database.Driver == "sqlite" && c.Database.DSN == "" {
		c.Database.DSN = filepath.Join(c.Data, "ufshare.db")
	}
}

func (c *Config) Validate() error {
	if c.JWT.Secret == "" {
		return fmt.Errorf(
			"JWT_SECRET environment variable is not set.\n" +
				"Please set a strong random secret before starting Uranus, e.g.:\n\n" +
				"  export JWT_SECRET=$(openssl rand -hex 32)\n\n" +
				"This secret is used to sign authentication tokens and must be kept private.",
		)
	}
	if c.JWT.Secret == defaultJWTSecret {
		return fmt.Errorf(
			"JWT_SECRET is set to the default insecure value.\n" +
				"Please replace it with a strong random secret, e.g.:\n\n" +
				"  export JWT_SECRET=$(openssl rand -hex 32)",
		)
	}
	return nil
}

// parseBodySize 解析人类可读的大小字符串，如 "1GB"、"500MB"、"10737418240"。
// 无法解析时返回默认值 DefaultBodySize。
func parseBodySize(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return DefaultBodySize
	}
	if s == "-1" {
		return -1
	}

	upper := strings.ToUpper(s)
	// 按后缀长度从长到短匹配，避免 "GB" 被 "B" 先匹配
	units := []struct {
		suffix string
		mult   int64
	}{
		{"TIB", 1 << 40}, {"GIB", 1 << 30}, {"MIB", 1 << 20}, {"KIB", 1 << 10},
		{"TB", 1_000_000_000_000}, {"GB", 1 << 30}, {"MB", 1 << 20}, {"KB", 1024}, {"B", 1},
	}
	for _, u := range units {
		if strings.HasSuffix(upper, u.suffix) {
			numStr := strings.TrimSpace(upper[:len(upper)-len(u.suffix)])
			n, err := strconv.ParseFloat(numStr, 64)
			if err != nil || n < 0 {
				return DefaultBodySize
			}
			return int64(n * float64(u.mult))
		}
	}

	// 纯数字（字节）
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return DefaultBodySize
	}
	return n
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
