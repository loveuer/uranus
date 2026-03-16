#!/bin/sh
set -e

URANUS_HOST="${URANUS_HOST:-uranus:5000}"
URANUS_URL="${URANUS_HOST}"

echo "=== Docker/OCI Registry 功能测试 ==="
echo "目标服务: ${URANUS_URL}"

# 等待服务就绪
echo "等待服务启动..."
for i in $(seq 1 30); do
    if wget -q --spider "http://${URANUS_URL}/v2/" 2>/dev/null; then
        echo "服务已就绪"
        break
    fi
    sleep 1
done

# 测试 V2 API
echo ""
echo "1. 测试 V2 API 版本检查"
RESPONSE=$(curl -s "http://${URANUS_URL}/v2/")
if [ -n "$RESPONSE" ]; then
    echo "✅ V2 API 响应正常"
else
    echo "❌ V2 API 无响应"
    exit 1
fi

# 登录 Registry
echo ""
echo "2. 登录 Docker Registry"
echo "admin123" | docker login ${URANUS_URL} -u admin --password-stdin
if [ $? -eq 0 ]; then
    echo "✅ Docker 登录成功"
else
    echo "❌ Docker 登录失败"
    exit 1
fi

# 拉取测试镜像
echo ""
echo "3. 拉取测试镜像 (alpine)"
docker pull alpine:latest
echo "✅ 测试镜像拉取成功"

# 标记镜像
echo ""
echo "4. 标记镜像推送到私有仓库"
docker tag alpine:latest ${URANUS_URL}/test-alpine:latest
echo "✅ 镜像标记完成"

# 推送镜像
echo ""
echo "5. 推送镜像到私有仓库"
docker push ${URANUS_URL}/test-alpine:latest
if [ $? -eq 0 ]; then
    echo "✅ 镜像推送成功"
else
    echo "❌ 镜像推送失败"
    exit 1
fi

# 删除本地镜像
echo ""
echo "6. 删除本地镜像"
docker rmi ${URANUS_URL}/test-alpine:latest
echo "✅ 本地镜像已删除"

# 从私有仓库拉取
echo ""
echo "7. 从私有仓库拉取镜像"
docker pull ${URANUS_URL}/test-alpine:latest
if [ $? -eq 0 ]; then
    echo "✅ 从私有仓库拉取成功"
else
    echo "❌ 从私有仓库拉取失败"
    exit 1
fi

# 测试多标签
echo ""
echo "8. 测试多标签推送"
docker tag alpine:latest ${URANUS_URL}/test-alpine:v1.0.0
docker push ${URANUS_URL}/test-alpine:v1.0.0
echo "✅ 多标签推送成功"

# 测试镜像列表
echo ""
echo "9. 测试 Catalog API"
CATALOG=$(curl -s "http://${URANUS_URL}/v2/_catalog")
if echo "$CATALOG" | grep -q "test-alpine"; then
    echo "✅ Catalog 包含推送的镜像"
else
    echo "⚠️  Catalog 可能未包含镜像"
fi

# 测试标签列表
echo ""
echo "10. 测试标签列表 API"
TAGS=$(curl -s "http://${URANUS_URL}/v2/test-alpine/tags/list")
if echo "$TAGS" | grep -q "latest"; then
    echo "✅ 标签列表包含 latest"
else
    echo "⚠️  标签列表可能为空"
fi

# 清理
echo ""
echo "清理测试镜像..."
docker rmi ${URANUS_URL}/test-alpine:latest ${URANUS_URL}/test-alpine:v1.0.0 2>/dev/null || true

echo ""
echo "=== Docker/OCI Registry 测试完成 ==="
