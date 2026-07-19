#!/bin/bash
# Mobile-Ops 后端 Binary 快速部署脚本
# 用法: bash scripts/deploy_backend_binary.sh
# 优势: 本地编译 -> 压缩 -> 上传 -> 解压 -> MD5校验 -> 原子替换
set -e

REMOTE_HOST="${REMOTE_HOST:-10.211.79.100}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="/data2/haowu33/mobile/backend"

echo "==> [1/6] 检查环境"
if [ -z "$SSHPASS" ]; then
    echo "❌ 请先 export SSHPASS='xxx'" >&2
    exit 1
fi

cd "$(dirname "$0")/../backend"

echo ""
echo "==> [2/6] 本地交叉编译 (Linux amd64)"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o mobile-ops ./cmd/server
LOCAL_MD5=$(md5 -q mobile-ops 2>/dev/null || md5sum mobile-ops | awk '{print $1}')
LOCAL_SIZE=$(ls -lh mobile-ops | awk '{print $5}')
echo "✅ 编译完成: ${LOCAL_SIZE}, MD5: ${LOCAL_MD5}"

echo ""
echo "==> [3/6] 压缩 binary (gzip 9级)"
gzip -9 -c mobile-ops > /tmp/mobile-ops.gz
COMPRESSED_SIZE=$(ls -lh /tmp/mobile-ops.gz | awk '{print $5}')
echo "✅ 压缩完成: ${COMPRESSED_SIZE} (原始 ${LOCAL_SIZE})"

echo ""
echo "==> [4/6] 上传到服务器"
sshpass -e scp -o StrictHostKeyChecking=no /tmp/mobile-ops.gz \
  $REMOTE_USER@$REMOTE_HOST:/tmp/mobile-ops.gz
echo "✅ 上传完成"

echo ""
echo "==> [5/6] 服务器端解压 + MD5 校验 + 原子替换"
sshpass -e ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST bash <<REMOTE_EOF
set -e

# 解压到临时文件
gunzip -c /tmp/mobile-ops.gz > /tmp/mobile-ops.new
chmod +x /tmp/mobile-ops.new

# MD5 校验
REMOTE_MD5=\$(md5sum /tmp/mobile-ops.new | awk '{print \$1}')
echo "远程 MD5: \$REMOTE_MD5"
if [ "\$REMOTE_MD5" != "$LOCAL_MD5" ]; then
  echo "❌ MD5 校验失败！本地: $LOCAL_MD5, 远程: \$REMOTE_MD5"
  exit 1
fi
echo "✅ MD5 校验通过"

# 备份旧 binary
cd $REMOTE_DIR/bin
if [ -f mobile-ops ]; then
  BACKUP_NAME="mobile-ops.bak.\$(date +%s)"
  cp mobile-ops "\$BACKUP_NAME"
  echo "✅ 已备份: \$BACKUP_NAME"
fi

# 原子替换（mv 是原子操作）
mv /tmp/mobile-ops.new mobile-ops
echo "✅ binary 已替换"

# 清理
rm -f /tmp/mobile-ops.gz
REMOTE_EOF

echo ""
echo "==> [6/6] 重启服务"
sshpass -e ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST bash <<'REMOTE_EOF'
systemctl restart mobile-ops
sleep 3
if systemctl is-active mobile-ops >/dev/null; then
  echo "✅ 服务已重启"
  curl -sf http://127.0.0.1:8090/api/v1/health >/dev/null && echo "✅ 后端健康检查通过" || echo "⚠️ 健康检查失败"
else
  echo "❌ 服务启动失败，查看日志："
  journalctl -u mobile-ops -n 20 --no-pager
  exit 1
fi
REMOTE_EOF

echo ""
echo "🎉 部署完成！"
echo "   本地 MD5: ${LOCAL_MD5}"
echo "   压缩前: ${LOCAL_SIZE}, 压缩后: ${COMPRESSED_SIZE}"
