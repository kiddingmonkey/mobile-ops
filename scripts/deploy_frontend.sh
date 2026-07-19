#!/bin/bash
# Mobile-Ops 前端自动化部署脚本
# 功能：编译 -> 打包 dist.zip -> 上传到服务器 -> 替换旧版本

set -e

SERVER="10.211.79.100"
SERVER_USER="root"
SERVER_PASS="${SSHPASS:-t*YhMbizGYe41Kvi}"
FRONTEND_DIR="/data2/haowu33/mobile/frontend"
DIST_ZIP_PATH="/data2/haowu33/mobile/frontend/dist.zip"

cd "$(dirname "$0")/../frontend"

echo "🧹 [1/6] 清理旧的 dist 目录..."
rm -rf dist dist.zip

echo "📦 [2/6] 编译前端..."
npm run build

echo "📦 [3/6] 打包 dist.zip..."
# 先清掉 macOS 生成的 ._xxx AppleDouble 文件（踩过坑：会污染服务器）
find dist -name '._*' -delete
find dist -name '.DS_Store' -delete
cd dist
zip -r ../dist.zip . -x "*.DS_Store" -x "._*"
cd ..

echo "📤 [4/6] 上传 dist 目录到服务器..."
export SSHPASS="$SERVER_PASS"
sshpass -e scp -o StrictHostKeyChecking=no -r dist/* ${SERVER_USER}@${SERVER}:${FRONTEND_DIR}/dist/

echo "📤 [5/6] 上传 dist.zip 到服务器 (用于 App 更新)..."
sshpass -e scp -o StrictHostKeyChecking=no dist.zip ${SERVER_USER}@${SERVER}:${DIST_ZIP_PATH}

echo "✅ [6/6] 验证部署..."
sshpass -e ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER} << 'EOF'
echo "📊 前端文件:"
ls -lh /data2/haowu33/mobile/frontend/dist/index.html
echo ""
echo "📦 更新包:"
ls -lh /data2/haowu33/mobile/frontend/dist.zip
EOF

echo ""
echo "✅ 前端部署完成！"
echo ""
echo "🌐 Web 访问: https://101-43-172-231.nip.io:18443/"
echo "📱 App 内检查更新即可获取最新版本"
echo ""
