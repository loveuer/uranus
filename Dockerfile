# Uranus 制品仓库管理系统
# 构建阶段
FROM golang:1.25-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache git

# 复制依赖文件
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 构建（前端 dist 目录需要在构建前准备好）
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -ldflags="-s -w -X main.Version=${VERSION}" -o uranus ./cmd/uranus

# 运行阶段
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

# 复制二进制文件到 PATH
COPY --from=builder /app/uranus /usr/local/bin/uranus
RUN chmod +x /usr/local/bin/uranus

# 创建数据目录
RUN mkdir -p /data

# 暴露端口
# 9817: 主端口 (HTTP API + Web UI)
# 5000: Docker/OCI Registry
# 4873: NPM Registry
EXPOSE 9817 5000 4873

# 环境变量
ENV JWT_SECRET=""
ENV DB_DRIVER=sqlite
ENV DB_DSN=/data/uranus.db
ENV DATA_DIR=/data

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9817/api/v1/auth/me || exit 1

# 运行（使用 CMD 作为入口，方便覆盖）
CMD ["uranus", "--address", "0.0.0.0:9817", "--data", "/data"]
