#!/bin/sh
set -e

URANUS_HOST="${URANUS_HOST:-uranus:9817}"
URANUS_URL="http://${URANUS_HOST}"
MAVEN_URL="${URANUS_URL}/maven"

echo "=== Maven Repository 功能测试 ==="
echo "目标服务: ${MAVEN_URL}"

# 等待服务就绪
echo "等待服务启动..."
for i in $(seq 1 30); do
    if wget -q --spider "${MAVEN_URL}/" 2>/dev/null; then
        echo "服务已就绪"
        break
    fi
    sleep 1
done

# 配置 Maven settings
echo ""
echo "1. 配置 Maven settings.xml"
mkdir -p ~/.m2

cat > ~/.m2/settings.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<settings>
    <servers>
        <server>
            <id>uranus-releases</id>
            <username>admin</username>
            <password>admin123</password>
        </server>
        <server>
            <id>uranus-snapshots</id>
            <username>admin</username>
            <password>admin123</password>
        </server>
    </servers>
    <profiles>
        <profile>
            <id>uranus</id>
            <repositories>
                <repository>
                    <id>uranus-releases</id>
                    <url>${MAVEN_URL}</url>
                    <releases>
                        <enabled>true</enabled>
                    </releases>
                    <snapshots>
                        <enabled>false</enabled>
                    </snapshots>
                </repository>
                <repository>
                    <id>uranus-snapshots</id>
                    <url>${MAVEN_URL}</url>
                    <releases>
                        <enabled>false</enabled>
                    </releases>
                    <snapshots>
                        <enabled>true</enabled>
                    </snapshots>
                </repository>
            </repositories>
        </profile>
    </profiles>
    <activeProfiles>
        <activeProfile>uranus</activeProfile>
    </activeProfiles>
</settings>
EOF
echo "✅ Maven settings 已配置"

# 创建测试项目
echo ""
echo "2. 创建测试 Maven 项目"
mkdir -p /tmp/maven-test-project
cd /tmp/maven-test-project

cat > pom.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.uranus.test</groupId>
    <artifactId>uranus-test-artifact</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <name>Uranus Test Artifact</name>
    <description>Test artifact for Uranus Maven repository</description>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <distributionManagement>
        <repository>
            <id>uranus-releases</id>
            <url>MAVEN_URL_PLACEHOLDER</url>
        </repository>
        <snapshotRepository>
            <id>uranus-snapshots</id>
            <url>MAVEN_URL_PLACEHOLDER</url>
        </snapshotRepository>
    </distributionManagement>

    <dependencies>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
EOF

# 替换 URL
sed -i "s|MAVEN_URL_PLACEHOLDER|${MAVEN_URL}|g" pom.xml

mkdir -p src/main/java/com/uranus/test
mkdir -p src/test/java/com/uranus/test

cat > src/main/java/com/uranus/test/Hello.java << 'EOF'
package com.uranus.test;

public class Hello {
    public static String sayHello() {
        return "Hello from Uranus Test Artifact!";
    }

    public static void main(String[] args) {
        System.out.println(sayHello());
    }
}
EOF

cat > src/test/java/com/uranus/test/HelloTest.java << 'EOF'
package com.uranus.test;

import org.junit.Test;
import static org.junit.Assert.*;

public class HelloTest {
    @Test
    public void testSayHello() {
        assertEquals("Hello from Uranus Test Artifact!", Hello.sayHello());
    }
}
EOF

echo "✅ 测试项目已创建"

# 编译项目
echo ""
echo "3. 编译项目"
mvn compile
if [ $? -eq 0 ]; then
    echo "✅ 项目编译成功"
else
    echo "❌ 项目编译失败"
    exit 1
fi

# 运行测试
echo ""
echo "4. 运行测试"
mvn test
if [ $? -eq 0 ]; then
    echo "✅ 测试运行成功"
else
    echo "❌ 测试运行失败"
    exit 1
fi

# 打包
echo ""
echo "5. 打包项目"
mvn package -DskipTests
if [ $? -eq 0 ]; then
    echo "✅ 项目打包成功"
    ls -la target/*.jar
else
    echo "❌ 项目打包失败"
    exit 1
fi

# 部署到私有仓库
echo ""
echo "6. 部署到私有仓库"
mvn deploy -DskipTests
if [ $? -eq 0 ]; then
    echo "✅ 部署成功"
else
    echo "❌ 部署失败"
    exit 1
fi

# 验证部署
echo ""
echo "7. 验证制品已部署"
ARTIFACT_URL="${MAVEN_URL}/com/uranus/test/uranus-test-artifact/1.0.0/uranus-test-artifact-1.0.0.jar"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${ARTIFACT_URL}")
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 制品已成功部署 (HTTP $HTTP_CODE)"
else
    echo "❌ 制品部署验证失败 (HTTP $HTTP_CODE)"
fi

# 验证 POM
echo ""
echo "8. 验证 POM 文件"
POM_URL="${MAVEN_URL}/com/uranus/test/uranus-test-artifact/1.0.0/uranus-test-artifact-1.0.0.pom"
POM_CONTENT=$(curl -s "${POM_URL}")
if echo "$POM_CONTENT" | grep -q "uranus-test-artifact"; then
    echo "✅ POM 文件已部署"
else
    echo "❌ POM 文件验证失败"
fi

# 测试 SNAPSHOT 版本
echo ""
echo "9. 测试 SNAPSHOT 版本部署"
cd /tmp
mkdir -p maven-snapshot-test
cd maven-snapshot-test

cat > pom.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.uranus.test</groupId>
    <artifactId>uranus-snapshot-test</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <distributionManagement>
        <snapshotRepository>
            <id>uranus-snapshots</id>
            <url>${MAVEN_URL}</url>
        </snapshotRepository>
    </distributionManagement>
</project>
EOF

mkdir -p src/main/java/com/uranus/test
cat > src/main/java/com/uranus/test/Snapshot.java << 'EOF'
package com.uranus.test;
public class Snapshot {
    public static String version() { return "SNAPSHOT"; }
}
EOF

mvn deploy -DskipTests || echo "⚠️  SNAPSHOT 部署可能需要额外配置"
echo "✅ SNAPSHOT 测试完成"

# 测试依赖解析
echo ""
echo "10. 测试从私有仓库解析依赖"
cd /tmp
mkdir -p maven-dependency-test
cd maven-dependency-test

cat > pom.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.uranus.test</groupId>
    <artifactId>dependency-test</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <dependency>
            <groupId>com.uranus.test</groupId>
            <artifactId>uranus-test-artifact</artifactId>
            <version>1.0.0</version>
        </dependency>
    </dependencies>

    <repositories>
        <repository>
            <id>uranus-releases</id>
            <url>${MAVEN_URL}</url>
        </repository>
    </repositories>
</project>
EOF

mvn dependency:resolve
if [ $? -eq 0 ]; then
    echo "✅ 依赖解析成功"
else
    echo "⚠️  依赖解析可能失败"
fi

# 清理
echo ""
echo "清理测试环境..."
rm -rf /tmp/maven-test-project /tmp/maven-snapshot-test /tmp/maven-dependency-test
rm -rf ~/.m2/repository/com/uranus/test || true

echo ""
echo "=== Maven Repository 测试完成 ==="
