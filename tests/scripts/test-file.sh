#!/bin/sh
set -e

URANUS_HOST="${URANUS_HOST:-uranus:9817}"
URANUS_URL="http://${URANUS_HOST}"

echo "=== File Store 功能测试 ==="
echo "目标服务: ${URANUS_URL}"

# 等待服务就绪
echo "等待服务启动..."
for i in $(seq 1 30); do
    if wget -q --spider "${URANUS_URL}/file-store" 2>/dev/null; then
        echo "服务已就绪"
        break
    fi
    sleep 1
done

# 获取认证 token
echo ""
echo "1. 登录获取 Token"
TOKEN=$(curl -s -X POST "${URANUS_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败"
    exit 1
fi
echo "✅ 登录成功，Token: ${TOKEN:0:20}..."

# 测试上传文件
echo ""
echo "2. 测试文件上传"
echo "Hello Uranus File Store Test - $(date)" > /tmp/test-file.txt
curl -s -X PUT "${URANUS_URL}/file-store/test/test-file.txt" \
    -H "Authorization: Bearer ${TOKEN}" \
    --data-binary @/tmp/test-file.txt

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${URANUS_URL}/file-store/test/test-file.txt" \
    -H "Authorization: Bearer ${TOKEN}" \
    --data-binary @/tmp/test-file.txt)

if [ "$HTTP_CODE" = "201" ]; then
    echo "✅ 文件上传成功 (HTTP $HTTP_CODE)"
else
    echo "❌ 文件上传失败 (HTTP $HTTP_CODE)"
    exit 1
fi

# 测试下载文件
echo ""
echo "3. 测试文件下载"
DOWNLOADED=$(curl -s "${URANUS_URL}/file-store/test/test-file.txt")
if echo "$DOWNLOADED" | grep -q "Hello Uranus"; then
    echo "✅ 文件下载成功，内容: $DOWNLOADED"
else
    echo "❌ 文件下载失败"
    exit 1
fi

# 测试 SHA256 校验
echo ""
echo "4. 测试 SHA256 校验"
SHA256_HEADER=$(curl -s -I "${URANUS_URL}/file-store/test/test-file.txt" | grep -i "X-SHA256" | tr -d '\r')
if [ -n "$SHA256_HEADER" ]; then
    echo "✅ SHA256 头存在: $SHA256_HEADER"
else
    echo "⚠️  SHA256 头不存在"
fi

# 测试嵌套路径
echo ""
echo "5. 测试嵌套路径上传"
curl -s -X PUT "${URANUS_URL}/file-store/releases/v1.0.0/app.tar.gz" \
    -H "Authorization: Bearer ${TOKEN}" \
    --data-binary "nested file content" > /dev/null

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URANUS_URL}/file-store/releases/v1.0.0/app.tar.gz")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 嵌套路径文件下载成功"
else
    echo "❌ 嵌套路径文件下载失败"
    exit 1
fi

# 测试大文件
echo ""
echo "6. 测试大文件上传 (1MB)"
dd if=/dev/urandom of=/tmp/large-file.bin bs=1M count=1 2>/dev/null
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${URANUS_URL}/file-store/test/large-file.bin" \
    -H "Authorization: Bearer ${TOKEN}" \
    --data-binary @/tmp/large-file.bin)

if [ "$HTTP_CODE" = "201" ]; then
    echo "✅ 大文件上传成功"
else
    echo "❌ 大文件上传失败 (HTTP $HTTP_CODE)"
fi

# 测试文件列表
echo ""
echo "7. 测试文件列表"
LIST=$(curl -s "${URANUS_URL}/file-store")
if echo "$LIST" | grep -q "test-file.txt"; then
    echo "✅ 文件列表获取成功"
else
    echo "⚠️  文件列表可能为空"
fi

# 测试删除文件
echo ""
echo "8. 测试文件删除"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${URANUS_URL}/file-store/test/test-file.txt" \
    -H "Authorization: Bearer ${TOKEN}")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 文件删除成功"
else
    echo "❌ 文件删除失败 (HTTP $HTTP_CODE)"
fi

# 验证删除
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URANUS_URL}/file-store/test/test-file.txt")
if [ "$HTTP_CODE" = "404" ]; then
    echo "✅ 文件已确认删除"
else
    echo "❌ 文件删除验证失败"
fi

# 测试未授权访问
echo ""
echo "9. 测试未授权上传"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${URANUS_URL}/file-store/unauth/test.txt" \
    --data-binary "unauthorized")

if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ 未授权上传被正确拒绝"
else
    echo "❌ 未授权上传未正确拒绝 (HTTP $HTTP_CODE)"
fi

# 测试路径穿越攻击
echo ""
echo "10. 测试路径穿越防护"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${URANUS_URL}/file-store/../etc/passwd" \
    -H "Authorization: Bearer ${TOKEN}" \
    --data-binary "evil")

if [ "$HTTP_CODE" = "400" ]; then
    echo "✅ 路径穿越攻击被阻止"
else
    echo "⚠️  路径穿越防护可能存在问题 (HTTP $HTTP_CODE)"
fi

echo ""
echo "=== File Store 测试完成 ==="
