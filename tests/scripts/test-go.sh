#!/bin/sh
set -e

URANUS_HOST="${URANUS_HOST:-uranus:9817}"
URANUS_URL="http://${URANUS_HOST}"
GOPROXY_URL="${URANUS_URL}/go"

echo "=== Go Modules Proxy 功能测试 ==="
echo "目标服务: ${GOPROXY_URL}"

# 等待服务就绪
echo "等待服务启动..."
for i in $(seq 1 30); do
    if wget -q --spider "${URANUS_URL}/go/" 2>/dev/null; then
        echo "服务已就绪"
        break
    fi
    sleep 1
done

# 配置 GOPROXY
echo ""
echo "1. 配置 GOPROXY"
export GOPROXY="${GOPROXY_URL},https://proxy.golang.org,direct"
export GONOSUMDB="*"
echo "✅ GOPROXY 已配置: $GOPROXY"

# 测试下载公共包
echo ""
echo "2. 测试下载公共包 (github.com/google/uuid)"
mkdir -p /tmp/go-test
cd /tmp/go-test

cat > go.mod << 'EOF'
module test-module

go 1.23
EOF

cat > main.go << 'EOF'
package main

import (
    "fmt"
    "github.com/google/uuid"
)

func main() {
    id := uuid.New()
    fmt.Printf("UUID: %s\n", id.String())
}
EOF

go mod tidy
if [ $? -eq 0 ]; then
    echo "✅ go mod tidy 成功"
else
    echo "❌ go mod tidy 失败"
    exit 1
fi

# 验证模块缓存
echo ""
echo "3. 验证模块已缓存"
if go list -m github.com/google/uuid; then
    echo "✅ 模块已正确下载"
else
    echo "❌ 模块下载失败"
    exit 1
fi

# 测试版本列表
echo ""
echo "4. 测试获取版本列表"
VERSIONS=$(curl -s "${GOPROXY_URL}/github.com/google/uuid/@v/list")
if [ -n "$VERSIONS" ]; then
    echo "✅ 版本列表获取成功"
    echo "   可用版本: $(echo $VERSIONS | head -1)..."
else
    echo "⚠️  版本列表为空"
fi

# 测试特定版本下载
echo ""
echo "5. 测试下载特定版本"
cat > go.mod << 'EOF'
module test-module

go 1.23

require github.com/google/uuid v1.3.0
EOF

go mod download
if [ $? -eq 0 ]; then
    echo "✅ 特定版本下载成功"
else
    echo "❌ 特定版本下载失败"
    exit 1
fi

# 测试 go.mod 文件获取
echo ""
echo "6. 测试获取 go.mod 文件"
MOD_CONTENT=$(curl -s "${GOPROXY_URL}/github.com/google/uuid/@v/v1.3.0.mod")
if echo "$MOD_CONTENT" | grep -q "module"; then
    echo "✅ go.mod 文件获取成功"
else
    echo "⚠️  go.mod 文件可能为空"
fi

# 测试 zip 文件获取
echo ""
echo "7. 测试获取模块 zip 文件"
ZIP_SIZE=$(curl -s -o /dev/null -w "%{size_download}" "${GOPROXY_URL}/github.com/google/uuid/@v/v1.3.0.zip")
if [ "$ZIP_SIZE" -gt 0 ]; then
    echo "✅ zip 文件获取成功 (大小: ${ZIP_SIZE} bytes)"
else
    echo "⚠️  zip 文件可能为空"
fi

# 测试最新版本
echo ""
echo "8. 测试获取最新版本"
LATEST=$(curl -s "${GOPROXY_URL}/github.com/google/uuid/@latest")
if [ -n "$LATEST" ]; then
    echo "✅ 最新版本信息获取成功"
else
    echo "⚠️  最新版本信息为空"
fi

# 测试构建
echo ""
echo "9. 测试构建项目"
go build -o /tmp/test-binary .
if [ $? -eq 0 ]; then
    echo "✅ 项目构建成功"
else
    echo "❌ 项目构建失败"
    exit 1
fi

# 运行构建产物
echo ""
echo "10. 运行构建产物"
/tmp/test-binary
if [ $? -eq 0 ]; then
    echo "✅ 程序运行正常"
else
    echo "❌ 程序运行失败"
fi

# 清理
echo ""
echo "清理测试环境..."
rm -rf /tmp/go-test /tmp/test-binary

echo ""
echo "=== Go Modules Proxy 测试完成 ==="
