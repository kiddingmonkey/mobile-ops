#!/bin/bash
# 自动更新 versions.json - 从 git commit 提取版本信息
set -e

SERVER="${REMOTE_HOST:-10.211.79.100}"
SERVER_USER="${REMOTE_USER:-root}"
VERSIONS_FILE="/data2/haowu33/mobile/frontend/versions.json"

if [ -z "$SSHPASS" ]; then
  echo "❌ 请先 export SSHPASS='xxx'" >&2
  exit 1
fi

cd "$(dirname "$0")/../frontend"

# 读取当前 version.json 获取版本信息
if [ ! -f "dist/version.json" ]; then
  echo "❌ dist/version.json 不存在，请先编译前端" >&2
  exit 1
fi

APP_VERSION=$(jq -r .appVersion dist/version.json)
BUILD_SHA=$(jq -r .buildSha dist/version.json)
BUILD_TIME=$(jq -r .buildTime dist/version.json)

echo "📦 当前构建信息："
echo "   版本: $APP_VERSION"
echo "   Commit: $BUILD_SHA"
echo "   时间: $BUILD_TIME"
echo ""

# 获取最新 commit 的 message 作为 changelog
cd ..
COMMIT_MSG=$(git log -1 --pretty=%B $BUILD_SHA 2>/dev/null || git log -1 --pretty=%B)
# 提取 commit message 的第一行作为描述
DESCRIPTION=$(echo "$COMMIT_MSG" | head -1 | sed 's/^[a-z]*: //')
# 将多行 commit message 转为 JSON 数组（过滤空行和特殊字符）
CHANGELOG=$(echo "$COMMIT_MSG" | tail -n +2 | grep -v '^$' | grep -v '^Co-Authored' | sed 's/^- //' | head -10 | jq -R . | jq -s .)

echo "📝 Changelog:"
echo "$COMMIT_MSG" | head -20
echo ""

# 生成新的版本记录（写入临时文件避免 heredoc 转义问题）
cat > /tmp/new_version.json <<EOF
{
  "version": "$APP_VERSION",
  "sha256": "",
  "size": $(stat -f%z frontend/dist.zip 2>/dev/null || stat -c%s frontend/dist.zip 2>/dev/null || echo 700000),
  "released_at": "$BUILD_TIME",
  "changelog": $CHANGELOG,
  "description": "$DESCRIPTION"
}
EOF

NEW_VERSION=$(cat /tmp/new_version.json)

echo "🔄 更新服务器上的 versions.json..."
export SSHPASS

# 将新版本 JSON 上传到服务器临时文件
sshpass -e scp -o StrictHostKeyChecking=no /tmp/new_version.json $SERVER_USER@$SERVER:/tmp/new_version.json

sshpass -e ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER bash <<'REMOTE_EOF'
set -e

VERSIONS_FILE="/data2/haowu33/mobile/frontend/versions.json"
NEW_VERSION=$(cat /tmp/new_version.json)
APP_VERSION=$(echo "$NEW_VERSION" | jq -r .version)

# 读取现有版本历史
if [ -f "$VERSIONS_FILE" ]; then
  EXISTING=$(cat "$VERSIONS_FILE")
else
  EXISTING='{"versions":[]}'
fi

# 检查是否已存在相同版本
if echo "$EXISTING" | jq -e ".versions[] | select(.version == \"$APP_VERSION\")" >/dev/null 2>&1; then
  echo "⚠️  版本 $APP_VERSION 已存在，替换为最新构建"
  # 移除旧版本
  EXISTING=$(echo "$EXISTING" | jq "del(.versions[] | select(.version == \"$APP_VERSION\"))")
fi

# 添加新版本到数组末尾
UPDATED=$(echo "$EXISTING" | jq ".versions += [$NEW_VERSION]")

# 写入文件
echo "$UPDATED" > "$VERSIONS_FILE"
echo "✅ 已更新 versions.json"

# 显示最新版本
echo ""
echo "📋 最新版本列表:"
jq -r '.versions[] | "  \(.version) - \(.description) (\(.released_at | split("T")[0]))"' "$VERSIONS_FILE"

# 清理临时文件
rm -f /tmp/new_version.json
REMOTE_EOF

echo ""
echo "✅ 版本历史已自动更新"
