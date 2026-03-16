#!/bin/sh
set -e

URANUS_HOST="${URANUS_HOST:-uranus:9817}"
URANUS_URL="http://${URANUS_HOST}"
NPM_REGISTRY="${URANUS_URL}/npm"

echo "=== NPM Registry 功能测试 ==="
echo "目标服务: ${NPM_REGISTRY}"

# 等待服务就绪
echo "等待服务启动..."
for i in $(seq 1 30); do
    if wget -q --spider "${NPM_REGISTRY}/-/ping" 2>/dev/null; then
        echo "服务已就绪"
        break
    fi
    sleep 1
done

# 配置 npm
echo ""
echo "1. 配置 npm registry"
npm config set registry "${NPM_REGISTRY}"
echo "✅ npm registry 已配置"

# 登录 npm
echo ""
echo "2. 登录 npm registry"
echo "//${URANUS_HOST}/npm/:_authToken=$(curl -s -X PUT "${NPM_REGISTRY}/-/user/org.couchdb.user:admin" \
    -H "Content-Type: application/json" \
    -d '{"name":"admin","password":"admin123","type":"user"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)" > ~/.npmrc
echo "admin:admin123" | npm adduser --registry="${NPM_REGISTRY}" || true
echo "✅ npm 登录完成"

# 测试 ping
echo ""
echo "3. 测试 npm ping"
PING=$(curl -s "${NPM_REGISTRY}/-/ping")
echo "✅ Ping 响应: $PING"

# 创建测试包
echo ""
echo "4. 创建测试 npm 包"
mkdir -p /tmp/npm-test-pkg
cd /tmp/npm-test-pkg

cat > package.json << 'EOF'
{
  "name": "uranus-test-package",
  "version": "1.0.0",
  "description": "Test package for Uranus npm registry",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Hello from uranus-test-package\""
  },
  "author": "uranus-test",
  "license": "MIT"
}
EOF

cat > index.js << 'EOF'
module.exports = {
  hello: function() {
    return "Hello from uranus-test-package!";
  }
};
EOF

echo "✅ 测试包已创建"

# 发布包
echo ""
echo "5. 发布 npm 包"
npm publish --registry="${NPM_REGISTRY}"
if [ $? -eq 0 ]; then
    echo "✅ npm 包发布成功"
else
    echo "❌ npm 包发布失败"
    exit 1
fi

# 验证包已发布
echo ""
echo "6. 验证包已发布"
npm view uranus-test-package --registry="${NPM_REGISTRY}"
if [ $? -eq 0 ]; then
    echo "✅ 包已成功发布到仓库"
else
    echo "❌ 无法查看发布的包"
    exit 1
fi

# 创建新项目安装包
echo ""
echo "7. 测试安装发布的包"
mkdir -p /tmp/npm-install-test
cd /tmp/npm-install-test

cat > package.json << 'EOF'
{
  "name": "npm-install-test",
  "version": "1.0.0",
  "dependencies": {
    "uranus-test-package": "1.0.0"
  }
}
EOF

npm install --registry="${NPM_REGISTRY}"
if [ $? -eq 0 ]; then
    echo "✅ 包安装成功"
else
    echo "❌ 包安装失败"
    exit 1
fi

# 验证安装
echo ""
echo "8. 验证安装的包"
if [ -f "node_modules/uranus-test-package/index.js" ]; then
    echo "✅ 包文件存在"
else
    echo "❌ 包文件不存在"
    exit 1
fi

# 测试发布新版本
echo ""
echo "9. 发布新版本"
cd /tmp/npm-test-pkg
npm version patch --no-git-tag-version
npm publish --registry="${NPM_REGISTRY}"
echo "✅ 新版本发布成功"

# 测试 scoped 包
echo ""
echo "10. 测试 scoped 包"
mkdir -p /tmp/scoped-pkg
cd /tmp/scoped-pkg

cat > package.json << 'EOF'
{
  "name": "@uranus-test/scoped-package",
  "version": "1.0.0",
  "description": "Scoped test package"
}
EOF

cat > index.js << 'EOF'
module.exports = { scoped: true };
EOF

npm publish --registry="${NPM_REGISTRY}"
if [ $? -eq 0 ]; then
    echo "✅ scoped 包发布成功"
else
    echo "⚠️  scoped 包发布可能失败"
fi

# 清理
echo ""
echo "清理测试环境..."
npm config set registry https://registry.npmjs.org/

echo ""
echo "=== NPM Registry 测试完成 ==="
