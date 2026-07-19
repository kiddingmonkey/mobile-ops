#!/bin/bash
# Mobile-Ops 前端快速部署脚本（优化版）
# 功能：编译 -> 打包 tar.gz -> 上传 -> 服务器端解压（避免 scp 数百个小文件超时）
set -e

SERVER="${REMOTE_HOST:-10.211.79.100}"
SERVER_USER="${REMOTE_USER:-root}"
SERVER_PASS="${SSHPASS:-t*YhMbizGYe41Kvi}"
FRONTEND_DIR="/data2/haowu33/mobile/frontend"
DIST_ZIP_PATH="/data2/haowu33/mobile/frontend/dist.zip"

cd "$(dirname "$0")/../frontend"

echo "🧹 [1/5] 清理旧的 dist 目录..."
rm -rf dist dist.zip dist.tar.gz

echo "📦 [2/5] 编译前端..."
npm run build

echo "📦 [3/5] 打包 dist (tar.gz 和 zip 双份)..."
# tar.gz 用于 scp 传输（速度快）
cd dist
# 先清掉 macOS 垃圾文件
find . -name '._*' -delete
find . -name '.DS_Store' -delete
tar czf ../dist.tar.gz .
# zip 用于 App OTA 更新
zip -r ../dist.zip . -x "*.DS_Store" -x "._*"
cd ..

TARBALL_SIZE=$(ls -lh dist.tar.gz | awk '{print $5}')
ZIP_SIZE=$(ls -lh dist.zip | awk '{print $5}')
echo "✅ 打包完成: dist.tar.gz (${TARBALL_SIZE}), dist.zip (${ZIP_SIZE})"

echo ""
echo "📤 [4/5] 上传 tar.gz 到服务器并解压..."
export SSHPASS="$SERVER_PASS"
sshpass -e scp -o StrictHostKeyChecking=no dist.tar.gz ${SERVER_USER}@${SERVER}:/tmp/mobile-ops-dist.tar.gz

sshpass -e ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER} bash <<'REMOTE_EOF'
set -e
cd /data2/haowu33/mobile/frontend
# 备份旧 dist
if [ -d dist ]; then
  BACKUP="dist.bak.$(date +%s)"
  mv dist "$BACKUP"
  echo "✅ 已备份旧版本: $BACKUP"
fi
# 解压新 dist
mkdir -p dist
cd dist
tar xzf /tmp/mobile-ops-dist.tar.gz
echo "✅ 解压完成，文件数: $(find . -type f | wc -l)"
rm -f /tmp/mobile-ops-dist.tar.gz
REMOTE_EOF

echo ""
echo "📤 [5/5] 上传 dist.zip (用于 App 热更新)..."
sshpass -e scp -o StrictHostKeyChecking=no dist.zip ${SERVER_USER}@${SERVER}:${DIST_ZIP_PATH}

echo ""
echo "✅ [验证] 检查部署..."
sshpass -e ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER} bash <<'REMOTE_EOF'
echo "📊 前端文件:"
ls -lh /data2/haowu33/mobile/frontend/dist/index.html
echo ""
echo "📦 更新包:"
ls -lh /data2/haowu33/mobile/frontend/dist.zip
echo ""
echo "🔍 version.json:"
cat /data2/haowu33/mobile/frontend/dist/version.json
REMOTE_EOF

echo ""
echo "✅ 前端部署完成！"

echo ""
echo "🔄 自动更新版本历史..."
bash "$(dirname "$0")/update_versions.sh"

echo ""
echo "🌐 Web 访问: https://101-43-172-231.nip.io:18443/"
echo "📱 App 内检查更新即可获取最新版本"
echo ""
