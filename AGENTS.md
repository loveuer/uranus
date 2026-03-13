# Agent Instructions

## 项目概述

Uranus 是一个轻量级制品仓库管理系统，目标是成为 JFrog Artifactory 的开源替代方案。

## 技术栈

- 语言: Go 1.25+
- Web 框架: [ursa](https://github.com/loveuer/ursa)
- ORM: GORM (支持 SQLite / MySQL / PostgreSQL)
- 前端: React + MUI

## 构建与运行

```bash
# 构建
go build -o uranus ./cmd/ufshare

# 运行
./uranus

# 测试
go test ./...

# 代码检查
go vet ./...
golangci-lint run
```

## 项目结构

```
.
├── cmd/uranus/        # 程序入口
├── internal/
│   ├── api/            # HTTP API 路由和处理器
│   │   ├── handler/    # 请求处理器
│   │   └── middleware/ # 中间件
│   ├── model/         # 数据模型 (GORM)
│   ├── service/       # 业务逻辑层
│   └── pkg/           # 内部工具包
├── pkg/                # 公共包
└── web/                # 前端 (React + MUI)
```

## 代码风格

- 遵循 Go 官方代码规范
- 使用 gofmt 格式化代码
- 错误处理使用 error wrapping
- 注释使用中文或英文均可

## 功能模块

### 已完成

- **File Store**: HTTP PUT/GET 文件存储
- **npm**: npm registry API (publish/install)
- **Go Modules**: Go proxy
- **Docker/OCI**: OCI Distribution API
- **Maven**: Maven repository proxy/cache
- **PyPI**: Python package index with upload support

### 开发规范

- 使用清晰的模块划分
- 遵循现有的代码结构模式
- 添加新功能时同步更新 Web UI
- 保持 API 风格一致
