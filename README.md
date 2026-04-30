# Uranus

<p align="center">
  <img src="web/public/uranus-logo.png" alt="Uranus Logo" width="200" />
</p>

<p align="center">
  <strong>Universal Artifact Repository</strong>
</p>

<p align="center">
  轻量级制品仓库管理系统，类似 JFrog Artifactory 的开源替代方案。
</p>

<p align="center">
  <a href="https://github.com/loveuer/uranus/releases">
    <img src="https://img.shields.io/github/v/release/loveuer/uranus?color=11998e&style=flat" alt="Version" />
  </a>
  <a href="https://github.com/loveuer/uranus/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/loveuer/uranus/build.yml?color=11998e" alt="Build" />
  </a>
  <a href="https://goreportcard.com/report/gitea.loveuer.com/loveuer/uranus/v2">
    <img src="https://goreportcard.com/badge/gitea.loveuer.com/loveuer/uranus/v2" alt="Go Report" />
  </a>
  <a href="https://github.com/loveuer/uranus/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/loveuer/uranus?color=11998e" alt="License" />
  </a>
</p>

---

## 特性

### 支持的模块

| 模块 | 协议 | 状态 |
|------|------|------|
| **File Store** | HTTP PUT/GET | ✅ 已完成 |
| **npm** | npm registry API | ✅ 已完成 |
| **Go Modules** | Go proxy | ✅ 已完成 |
| **Docker/OCI** | OCI Distribution | ✅ 已完成 |
| **Maven** | Maven repository | ✅ 已完成 |
| **PyPI** | Python package index | ✅ 已完成 |

### 核心功能

- **多模块支持**: 支持文件、npm、Go、Docker、Maven、PyPI 等多种制品类型
- **代理缓存**: 自动从上游仓库代理并缓存包，减少重复下载
- **用户权限**: 完整的用户认证和权限管理系统
- **RESTful API**: 统一的 Web API 接口
- **Web UI**: 现代 Web 管理界面
- **独立端口**: 支持各模块独立端口部署

## 技术栈

- **后端**: Go 1.25+ / [ursa](https://github.com/loveuer/ursa) / GORM
- **前端**: React + MUI
- **数据库**: SQLite / MySQL / PostgreSQL

## 快速开始

### 使用预编译二进制

```bash
# 下载最新版本
curl -L https://github.com/loveuer/uranus/releases/latest/download/uranus-linux-amd64 -o uranus
chmod +x uranus

# 运行
./uranus --data ./data
```

### 使用 Docker

```bash
# 启动服务
docker run -d \
  --name uranus \
  -p 9817:9817 \
  -v $(pwd)/data:/data \
  -e JWT_SECRET=your-secret-key \
  loveuer/uranus:latest

# 访问 Web UI
# http://localhost:9817
```

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/loveuer/uranus.git
cd uranus

# 构建
go build -o uranus ./cmd/uranus

# 运行
./uranus --data ./data
```

### 默认配置

- **监听地址**: `0.0.0.0:9817`
- **默认管理员**: `admin / admin123`
- **JWT Secret**: 需要通过环境变量设置

```bash
export JWT_SECRET=$(openssl rand -hex 32)
./uranus --data ./data
```

## 模块使用

### npm

```bash
# 设置私有 registry
npm config set registry http://localhost:9817/npm

# 发布包
npm publish

# 安装包
npm install <package>
```

### PyPI

```bash
# 设置私有 index
pip install -i http://localhost:9817/simple/ <package>

# 上传包 (使用 twine)
twine upload --repository-url http://localhost:9817/legacy/ dist/*
```

### Docker

```bash
# 登录私有 registry
docker login localhost:9817

# 推送镜像
docker tag myapp:latest localhost:9817/myapp:latest
docker push localhost:9817/myapp:latest

# 拉取镜像
docker pull localhost:9817/myapp:latest
```

### Maven

```bash
# 配置 Maven settings.xml
<mirror>
  <id>uranus</id>
  <mirrorOf>*</mirrorOf>
  <url>http://localhost:9817/maven</url>
</mirror>
```

### Go Modules

```bash
# 设置 Go proxy
export GOPROXY=http://localhost:9817/go

# 下载模块
go get github.com/example/module
```

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | - | **必须设置** JWT 签名密钥 |
| `DB_DRIVER` | `sqlite` | 数据库驱动 (sqlite/mysql/postgres) |
| `DB_DSN` | - | 数据库连接字符串 |
| `BODY_SIZE` | `1GB` | 请求体大小限制 |

### CLI 参数

```bash
uranus --help

Usage of uranus:
  --address string     监听地址 (e.g. 0.0.0.0:9817)
  --data string        数据目录，存放文件和数据库
  --db string          SQLite 数据库文件路径
  --debug              开启 debug 模式
  --npm-addr string    npm 专用端口
  --file-addr string   file-store 专用端口
  --go-addr string     Go 模块代理专用端口
  --oci-addr string    OCI/Docker 镜像代理专用端口
  --maven-addr string  Maven 仓库专用端口
  --pypi-addr string  PyPI 仓库专用端口
```

## API 文档

详细 API 文档请参考 [API Docs](./docs/api.md)

## Roadmap / TODO

| 项目 | 状态 |
|------|------|
| Alpine APK 管理页面（前端） | 🔜 待开发 |

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License - 详见 [LICENSE](./LICENSE)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/loveuer">loveuer</a>
</p>
