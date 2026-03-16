#!/bin/bash
# 运行所有功能测试

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  Uranus 功能测试套件"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果
PASSED=0
FAILED=0

run_test() {
    local test_name=$1
    local test_cmd=$2

    echo ""
    echo "----------------------------------------"
    echo "运行测试: $test_name"
    echo "----------------------------------------"

    if eval "$test_cmd"; then
        echo -e "${GREEN}✅ $test_name 通过${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ $test_name 失败${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# 检查是否在 CI 环境中
if [ -z "$CI" ]; then
    # 本地运行：使用 docker-compose
    echo "本地运行模式：使用 docker-compose"

    # 构建测试镜像
    echo "构建测试镜像..."
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" build uranus

    # 运行各个测试
    for test in file docker npm go pypi maven; do
        echo ""
        echo "启动 $test 测试..."
        docker-compose -f "$SCRIPT_DIR/docker-compose.yml" run --rm test-$test 2>&1 | tee "/tmp/test-$test.log" || true

        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo -e "${GREEN}✅ $test 测试通过${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}❌ $test 测试失败${NC}"
            FAILED=$((FAILED + 1))
        fi
    done

    # 清理
    echo ""
    echo "清理 Docker 资源..."
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" down -v

else
    # CI 环境
    echo "CI 运行模式"

    # 启动 Uranus 服务
    echo "启动 Uranus 服务..."
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" up -d uranus

    # 等待服务就绪
    echo "等待服务就绪..."
    for i in $(seq 1 60); do
        if curl -s "http://localhost:9817/file-store" > /dev/null 2>&1; then
            echo "服务已就绪"
            break
        fi
        sleep 2
    done

    # 运行测试
    for test in file docker npm go pypi maven; do
        if [ -f "$SCRIPT_DIR/scripts/test-$test.sh" ]; then
            export URANUS_HOST="localhost:9817"
            run_test "$test" "sh $SCRIPT_DIR/scripts/test-$test.sh"
        fi
    done

    # 清理
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" down -v
fi

# 输出结果
echo ""
echo "========================================"
echo "  测试结果汇总"
echo "========================================"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}存在失败的测试！${NC}"
    exit 1
else
    echo -e "${GREEN}所有测试通过！${NC}"
    exit 0
fi
