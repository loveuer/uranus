# Uranus 功能测试方案

## 概述

本测试方案使用真实的客户端工具对 Uranus 进行端到端功能测试，确保各模块在实际使用场景下的正确性。

## 测试环境

测试使用 Docker Compose 编排以下服务：

- **uranus**: 被测服务
- **test-file**: File Store 功能测试 (curl)
- **test-docker**: Docker/OCI Registry 功能测试 (docker client)
- **test-npm**: NPM Registry 功能测试 (npm)
- **test-go**: Go Modules Proxy 功能测试 (go)
- **test-pypi**: PyPI Registry 功能测试 (pip, twine)
- **test-maven**: Maven Repository 功能测试 (mvn)

## 快速开始

### 运行所有测试

```bash
cd tests
./run-tests.sh
```

### 运行单个模块测试

```bash
# File Store 测试
docker-compose run --rm test-file

# Docker/OCI 测试
docker-compose run --rm test-docker

# NPM 测试
docker-compose run --rm test-npm

# Go Proxy 测试
docker-compose run --rm test-go

# PyPI 测试
docker-compose run --rm test-pypi

# Maven 测试
docker-compose run --rm test-maven
```

### 本地开发测试

1. 启动 Uranus 服务：
```bash
docker-compose up -d uranus
```

2. 手动运行测试脚本：
```bash
export URANUS_HOST=localhost:9817
./scripts/test-file.sh
```

## 测试详情

### v1.1.0 - File Store 测试

使用 `curl` 测试文件上传下载功能：

| 测试项 | 描述 |
|-------|------|
| 文件上传 | PUT 上传文件到指定路径 |
| 文件下载 | GET 下载已上传的文件 |
| SHA256 校验 | 验证响应头中的 SHA256 |
| 嵌套路径 | 测试多级目录路径 |
| 大文件上传 | 上传 1MB 文件 |
| 文件列表 | 获取文件列表 |
| 文件删除 | 删除已上传的文件 |
| 未授权访问 | 验证无 token 时拒绝上传 |
| 路径穿越防护 | 验证 `../` 等路径被拒绝 |

### v1.1.1 - Docker/OCI Registry 测试

使用 `docker` 客户端测试镜像仓库功能：

| 测试项 | 描述 |
|-------|------|
| V2 API 检查 | GET /v2/ 验证 API 版本 |
| Registry 登录 | docker login 登录私有仓库 |
| 镜像推送 | docker push 推送镜像 |
| 镜像拉取 | docker pull 从私有仓库拉取 |
| 多标签支持 | 推送和拉取不同标签 |
| Catalog API | 列出仓库中的镜像 |
| Tags API | 列出镜像的标签 |

### v1.1.2 - Go Modules Proxy 测试

使用 `go` 命令测试模块代理功能：

| 测试项 | 描述 |
|-------|------|
| 模块下载 | go mod tidy 下载依赖 |
| 版本列表 | 获取模块可用版本 |
| 特定版本 | 下载指定版本模块 |
| go.mod 获取 | 获取模块的 go.mod 文件 |
| zip 下载 | 下载模块源码压缩包 |
| 最新版本 | 获取模块最新版本信息 |
| 项目构建 | 编译使用代理下载的项目 |

### v1.1.3 - NPM Registry 测试

使用 `npm` 客户端测试包仓库功能：

| 测试项 | 描述 |
|-------|------|
| npm ping | 测试服务连通性 |
| npm login | 登录私有仓库 |
| 包发布 | npm publish 发布包 |
| 包安装 | npm install 安装包 |
| 版本更新 | 发布新版本 |
| scoped 包 | 测试 @scope/package 格式 |
| 包查询 | npm view 查看包信息 |

### v1.1.4 - PyPI Registry 测试

使用 `pip` 和 `twine` 测试 Python 包仓库功能：

| 测试项 | 描述 |
|-------|------|
| Simple Index | GET /simple/ 获取包列表 |
| 包构建 | python -m build 构建 wheel/sdist |
| 包上传 | twine upload 上传包 |
| 包安装 | pip install 安装包 |
| 包导入 | 验证安装的包可导入 |
| 版本更新 | 上传新版本 |
| 依赖下载 | 测试代理下载公共包 |

### v1.1.5 - Maven Repository 测试

使用 `mvn` 测试 Java 制品仓库功能：

| 测试项 | 描述 |
|-------|------|
| 项目编译 | mvn compile 编译项目 |
| 项目打包 | mvn package 打包 JAR |
| 制品部署 | mvn deploy 上传到仓库 |
| 制品下载 | 从仓库解析依赖 |
| POM 文件 | 验证 POM 文件部署 |
| SNAPSHOT | 测试 SNAPSHOT 版本 |
| 依赖解析 | mvn dependency:resolve |

## CI/CD 集成

GitHub Actions 工作流 `.github/workflows/e2e-tests.yml` 配置：

- **触发条件**: push/PR 到 main/master 分支
- **并行执行**: 各模块测试独立运行
- **手动触发**: 可选择运行特定模块
- **结果汇总**: 生成测试报告

### 手动触发特定测试

在 GitHub Actions 页面选择 "Run workflow"，输入模块名称：
- `all` - 运行所有测试
- `file` - 仅 File Store
- `docker` - 仅 Docker/OCI
- `npm` - 仅 NPM
- `go` - 仅 Go Proxy
- `pypi` - 仅 PyPI
- `maven` - 仅 Maven

## 目录结构

```
tests/
├── docker-compose.yml      # Docker Compose 配置
├── Dockerfile.test         # 测试镜像构建文件
├── run-tests.sh           # 主测试运行脚本
├── scripts/
│   ├── test-file.sh       # File Store 测试
│   ├── test-docker.sh     # Docker/OCI 测试
│   ├── test-npm.sh        # NPM 测试
│   ├── test-go.sh         # Go Proxy 测试
│   ├── test-pypi.sh       # PyPI 测试
│   └── test-maven.sh      # Maven 测试
└── fixtures/
    ├── npm/               # NPM 测试数据
    ├── pypi/              # PyPI 测试数据
    └── maven/             # Maven 测试数据
```

## 故障排查

### 查看服务日志

```bash
docker-compose logs uranus
```

### 重新构建镜像

```bash
docker-compose build --no-cache uranus
```

### 清理测试环境

```bash
docker-compose down -v
```

### 常见问题

1. **端口冲突**: 确保本地 9817、5000、4873 端口未被占用
2. **权限问题**: 确保 scripts 目录下的脚本有执行权限
3. **网络问题**: CI 环境中可能需要调整等待时间
