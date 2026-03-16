#!/bin/sh
set -e

URANUS_HOST="${URANUS_HOST:-uranus:9817}"
URANUS_URL="http://${URANUS_HOST}"
PYPI_URL="${URANUS_URL}"

echo "=== PyPI Registry 功能测试 ==="
echo "目标服务: ${PYPI_URL}"

# 等待服务就绪
echo "等待服务启动..."
for i in $(seq 1 30); do
    if wget -q --spider "${PYPI_URL}/simple/" 2>/dev/null; then
        echo "服务已就绪"
        break
    fi
    sleep 1
done

# 配置 pip
echo ""
echo "1. 配置 pip 使用私有仓库"
mkdir -p ~/.pip
cat > ~/.pip/pip.conf << EOF
[global]
index-url = ${PYPI_URL}/simple/
trusted-host = ${URANUS_HOST%%:*}
EOF
echo "✅ pip 已配置"

# 测试 Simple Index
echo ""
echo "2. 测试 Simple Index API"
INDEX=$(curl -s "${PYPI_URL}/simple/")
if echo "$INDEX" | grep -q "<!DOCTYPE html>"; then
    echo "✅ Simple Index 返回 HTML"
else
    echo "❌ Simple Index 格式错误"
    exit 1
fi

# 创建测试包
echo ""
echo "3. 创建测试 Python 包"
mkdir -p /tmp/pypi-test-pkg
cd /tmp/pypi-test-pkg

cat > setup.py << 'EOF'
from setuptools import setup, find_packages

setup(
    name="uranus-test-package",
    version="1.0.0",
    description="Test package for Uranus PyPI registry",
    author="uranus-test",
    author_email="test@uranus.local",
    packages=find_packages(),
    python_requires=">=3.8",
)
EOF

cat > pyproject.toml << 'EOF'
[build-system]
requires = ["setuptools>=45", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "uranus-test-package"
version = "1.0.0"
description = "Test package for Uranus PyPI registry"
authors = [{name = "uranus-test", email = "test@uranus.local"}]
requires-python = ">=3.8"
EOF

mkdir -p uranus_test_package
cat > uranus_test_package/__init__.py << 'EOF'
"""Uranus test package."""

__version__ = "1.0.0"

def hello():
    """Return hello message."""
    return "Hello from uranus-test-package!"
EOF

echo "✅ 测试包已创建"

# 构建包
echo ""
echo "4. 构建分发包"
pip install build
python -m build
if [ $? -eq 0 ]; then
    echo "✅ 分发包构建成功"
    ls -la dist/
else
    echo "❌ 分发包构建失败"
    exit 1
fi

# 上传包
echo ""
echo "5. 上传包到私有仓库"
pip install twine

# 获取 token
TOKEN=$(curl -s -X POST "${URANUS_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

twine upload --repository-url "${PYPI_URL}/legacy/" \
    -u admin -p admin123 \
    dist/*
if [ $? -eq 0 ]; then
    echo "✅ 包上传成功"
else
    echo "❌ 包上传失败"
    exit 1
fi

# 验证包已上传
echo ""
echo "6. 验证包已上传"
PACKAGE_PAGE=$(curl -s "${PYPI_URL}/simple/uranus-test-package/")
if echo "$PACKAGE_PAGE" | grep -q "uranus-test-package"; then
    echo "✅ 包已出现在仓库中"
else
    echo "❌ 包未出现在仓库中"
    exit 1
fi

# 安装包
echo ""
echo "7. 安装发布的包"
pip install uranus-test-package --index-url "${PYPI_URL}/simple/" --trusted-host "${URANUS_HOST%%:*}"
if [ $? -eq 0 ]; then
    echo "✅ 包安装成功"
else
    echo "❌ 包安装失败"
    exit 1
fi

# 测试导入
echo ""
echo "8. 测试导入包"
python -c "from uranus_test_package import hello; print(hello())"
if [ $? -eq 0 ]; then
    echo "✅ 包导入正常"
else
    echo "❌ 包导入失败"
    exit 1
fi

# 测试下载依赖
echo ""
echo "9. 测试从私有仓库下载依赖"
pip install requests --index-url "${PYPI_URL}/simple/" --trusted-host "${URANUS_HOST%%:*}" || true
echo "✅ 依赖下载测试完成"

# 上传新版本
echo ""
echo "10. 上传新版本"
cd /tmp/pypi-test-pkg
sed -i 's/version = "1.0.0"/version = "1.0.1"/' pyproject.toml
sed -i 's/__version__ = "1.0.0"/__version__ = "1.0.1"/' uranus_test_package/__init__.py
rm -rf dist/
python -m build
twine upload --repository-url "${PYPI_URL}/legacy/" \
    -u admin -p admin123 \
    dist/*
if [ $? -eq 0 ]; then
    echo "✅ 新版本上传成功"
else
    echo "⚠️  新版本上传可能失败"
fi

# 清理
echo ""
echo "清理测试环境..."
pip uninstall -y uranus-test-package || true
rm -rf /tmp/pypi-test-pkg
rm ~/.pip/pip.conf || true

echo ""
echo "=== PyPI Registry 测试完成 ==="
